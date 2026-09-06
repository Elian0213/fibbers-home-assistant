/* ================================================================== *
 * fibbers-light-detail — the full light control used by the more-info modal.
 * Single light: brightness, a warm→cool temperature slider, a colour wheel and
 * quick swatches. Opened from a room/group (siblings): a Philips-Hue-style room
 * picker — one warm-centred wheel carrying a draggable icon marker per lamp
 * (colour lamps by hue/saturation, warm-only lamps by kelvin radius; drag a marker
 * onto another to snap them together), brightness + swatches, and the lamps as
 * tiles below. Reuses the shared slider primitives.
 * ================================================================== */
import { LitElement, html, unsafeCSS, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { closeSheet } from "@core/body-sheet";
import { hsToRgb, rgbToKelvin } from "@shared/color";
import { t } from "@shared/i18n";
import { cardShell } from "@shared/shells";
import { twSheet } from "@shared/tw";
import {
  sliderTrack,
  sliderDrag,
  pillSwitch,
  activateOnKey,
  SliderHold,
  type SliderDragHandlers,
} from "@shared/ui";
import {
  pctFromX,
  isUnavail,
  debounce,
  clamp,
  pickEntity,
  capturePointer,
  type Debounced,
} from "@shared/util";
import { cx } from "@shared/variants";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
  LovelaceCardConfig,
} from "@/types/home-assistant";
// Wheel/scrollbar/container-query CSS — real CSS, co-located; Vite inlines it.
import lightDetailCss from "./light-detail.css?inline";
import "@shared/icon";

const COLOR_MODES = ["hs", "rgb", "rgbw", "rgbww", "xy"];
// Quick swatches: three whites (kelvin) then a spread of hues (hue, saturation).
const WHITES = [
  { key: "warm", k: 2700, css: "#ffb96b" },
  { key: "neutral", k: 4000, css: "#ffe6c2" },
  { key: "cool", k: 6500, css: "#dce8ff" },
];
const HUES = [0, 30, 60, 120, 200, 260, 300];
// A fixed display range for the warm track so every lamp's dot sits on one scale.
const STRIP_LO = 2000;
const STRIP_HI = 6535;
// The warm track spans x = 12%..88% of the disc (centre row); warm left, cool right.
const TRACK_X0 = 12;
const TRACK_W = 76;
// Drag snap distance (px) between two markers before they merge into one group.
const SNAP_PX = 18;

// tiny colour helpers, for committing a group across lamp kinds — shared/color.ts

// One brightness/temperature slider's controllers + drag state.
interface SliderBundle {
  dragging: boolean;
  dragPct: number;
  hold: SliderHold;
  debounced: Debounced<[number]>;
  drag: SliderDragHandlers;
}

// Live drag state for the colour/warm wheel.
interface WheelState {
  kind: "colour" | "warm" | null;
  warm?: boolean;
  members: string[];
  dragging: boolean;
  hue?: number;
  sat?: number;
  k?: number;
}

// One marker on the wheel — a solo lamp or a group moving as one.
interface WheelUnit {
  rep: string;
  members: string[];
  warm: boolean;
}

/** YAML/editor config accepted by `fibbers-light-detail`. */
export interface LightDetailConfig extends LovelaceCardConfig {
  entity: string;
  name?: string;
  icon?: string;
  title?: string;
  groupName?: string;
  siblings?: string[];
  language?: string;
}

/**
 * fibbers-light-detail — a full light control (brightness, temperature, a colour
 * wheel, swatches) and, when opened for a room/group, a multi-lamp room picker.
 */
@customElement("fibbers-light-detail")
export class FibbersLightDetail extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config!: LightDetailConfig;

  @state() private _v = 0; // bump to force re-render on drag frames

  private _sl: Record<string, SliderBundle> = {};

  private _wheel: WheelState = { kind: null, members: [], dragging: false };

  private _cHold: Map<string, { h: number; s: number; exp: number }> =
    new Map();

  private _kHold: Map<string, { k: number; exp: number }> = new Map();

  private _groups: Set<string>[] = [];

  private _groupsSig?: string;

  private _colourCommit?: Debounced<[{ id?: string; h: number; s: number }]>;

  private _warmCommit?: Debounced<[{ id?: string; k: number }]>;

  static styles = [twSheet, unsafeCSS(lightDetailCss)];

  /** Seed config for the picker — a light entity from the dashboard. */
  static getStubConfig(
    _hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[],
  ): LightDetailConfig {
    return {
      type: "custom:fibbers-light-detail",
      entity: pickEntity("light", entities, entitiesFallback, "light.example"),
    };
  }

  /** Validate + build the brightness/temperature slider controllers and drag state. */
  setConfig(config: LightDetailConfig): void {
    if (!config || !config.entity || !config.entity.startsWith("light.")) {
      throw new Error("fibbers-light-detail: `entity` must be a light.*");
    }
    this.config = config;
    this._v = 0;
    // Brightness + temperature keep the shared slider pipeline (active lamp).
    this._sl = this._sl || {};
    this._mk("bri", (pct) => {
      const p = Math.round(pct);
      // Mirror light-row: dragging to zero turns the lamp off, not turn_on 0%.
      if (p <= 0) this._callOff();
      else this._call({ brightness_pct: p });
    });
    this._mk("temp", (pct) => {
      const [lo, hi] = this._kRange();
      this._call({
        color_temp_kelvin: Math.round(lo + (pct / 100) * (hi - lo)),
      });
    });
    // Room bar: one slider driving every lamp at once (mirrors light-group).
    this._mk(
      "grp",
      (pct) => {
        const p = Math.round(pct);
        if (p <= 0) this._callOff(this._lamps());
        else this._call({ brightness_pct: p }, this._lamps());
      },
      () => this._allUnavail(),
    );
    // The wheel drives one unit (a lamp or a group) at a time; a per-lamp display
    // hold keeps each dragged marker on its committed spot until the lamp reports.
    this._wheel = this._wheel || { kind: null, members: [], dragging: false };
    this._cHold = this._cHold || new Map(); // id → { h, s, exp }
    this._kHold = this._kHold || new Map(); // id → { k, exp }
    // Ephemeral colour groups (Set<id>[]); reset when the room's lamps change.
    const sig = Array.isArray(config.siblings)
      ? config.siblings.join(",")
      : config.entity;
    if (this._groupsSig !== sig) {
      this._groups = [];
      this._groupsSig = sig;
    }
    if (!this._colourCommit)
      this._colourCommit = debounce(
        (a) =>
          this._call({ hs_color: [Math.round(a.h), Math.round(a.s)] }, a.id),
        110,
      );
    if (!this._warmCommit)
      this._warmCommit = debounce(
        (a) => this._call({ color_temp_kelvin: Math.round(a.k) }, a.id),
        110,
      );
  }

  private _mk(
    key: string,
    commit: (v: number) => void,
    guard?: () => boolean,
  ): void {
    if (this._sl[key]) {
      this._sl[key].hold.clear();
      return;
    }
    const s = { dragging: false, dragPct: 0 } as SliderBundle;
    s.hold = new SliderHold(this, { tolerance: 2, timeout: 2500 });
    // Arm the hold on every commit so the control holds the committed value until
    // the light reports it (no snap-back to the stale value on release).
    s.debounced = debounce((v: number) => {
      s.hold.hold(v);
      commit(v);
    }, 120);
    s.drag = sliderDrag({
      guard: guard || (() => this._unavail()),
      read: (e) => Math.round(pctFromX(e.clientX, e.currentTarget as Element)),
      frame: (v, dragging) => {
        s.dragging = dragging;
        if (v != null) s.dragPct = v;
        this._v++;
      },
      live: (v) => s.debounced(v),
      end: (v) => {
        if (v == null) {
          s.debounced.cancel();
          return;
        }
        s.debounced(v);
        s.debounced.flush();
      },
    });
    this._sl[key] = s;
  }

  /** Cancel pending writes on unmount. */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    Object.values(this._sl || {}).forEach((s) => s.debounced.cancel());
    if (this._colourCommit) this._colourCommit.cancel();
    if (this._warmCommit) this._warmCommit.cancel();
  }

  // --- lamp accessors (generic over an entity id) -------------------------------

  private _lSt(id: string): HassEntity | undefined {
    return this.hass && this.hass.states[id];
  }

  private _lOn(id: string): boolean {
    const st = this._lSt(id);
    return !!st && st.state === "on";
  }

  private _lUnavail(id: string): boolean {
    return isUnavail(this._lSt(id));
  }

  // The whole room is gone only when every lamp is — gates the group slider.
  private _allUnavail(): boolean {
    return this._lamps().every((id) => this._lUnavail(id));
  }

  private _lAttr(id: string, k: string): unknown {
    const st = this._lSt(id);
    return st && st.attributes ? st.attributes[k] : undefined;
  }

  private _lModes(id: string): string[] {
    return (this._lAttr(id, "supported_color_modes") as string[]) || [];
  }

  private _lHasColor(id: string): boolean {
    return this._lModes(id).some((m) => COLOR_MODES.includes(m));
  }

  private _lHasTemp(id: string): boolean {
    return this._lModes(id).includes("color_temp");
  }

  private _lHs(id: string): [number, number] {
    const hs = this._lAttr(id, "hs_color");
    return Array.isArray(hs) ? (hs as [number, number]) : [0, 0];
  }

  private _lKRange(id: string): [number, number] {
    const lo = Number(this._lAttr(id, "min_color_temp_kelvin")) || STRIP_LO;
    const hi = Number(this._lAttr(id, "max_color_temp_kelvin")) || STRIP_HI;
    return [lo, hi > lo ? hi : lo + 1];
  }

  private _lKelvin(id: string): number | null {
    const k = Number(this._lAttr(id, "color_temp_kelvin"));
    return Number.isFinite(k) ? k : null;
  }

  // Active-lamp shorthands (the entity the brightness/temp sliders + swatches drive).
  private _st(): HassEntity | undefined {
    return this._lSt(this.config.entity);
  }

  private _unavail(): boolean {
    return this._lUnavail(this.config.entity);
  }

  private _on(): boolean {
    return this._lOn(this.config.entity);
  }

  private _attr(k: string): unknown {
    return this._lAttr(this.config.entity, k);
  }

  private _hasTemp(): boolean {
    return this._lHasTemp(this.config.entity);
  }

  private _hasColor(): boolean {
    return this._lHasColor(this.config.entity);
  }

  private _kRange(): [number, number] {
    return this._lKRange(this.config.entity);
  }

  // Lamp set: the room's siblings, else just this light.
  private _lamps(): string[] {
    const ids = this.config.siblings;
    const live = Array.isArray(ids)
      ? ids.filter((id) => this._lSt(id))
      : [this.config.entity];
    return live.length ? live : [this.config.entity];
  }

  private _room(): boolean {
    return this._lamps().length > 1;
  }

  private _colourLamps(): string[] {
    // On, colour-capable, and actually reporting a colour — excludes a light that
    // advertises a colour mode but has no hs_color (it would sit at a bogus 0,0).
    return this._lamps().filter(
      (id) =>
        this._lOn(id) &&
        this._lHasColor(id) &&
        Array.isArray(this._lAttr(id, "hs_color")),
    );
  }

  // --- per-lamp colour / warm display holds -------------------------------------

  private _hueDiff(a: number, b: number): number {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  // Displayed hue/sat for a lamp: the live drag value while its dot is dragged,
  // else the committed hold until the entity catches up, else the entity value.
  private _dispHs(id: string): [number, number] {
    if (
      this._wheel.dragging &&
      this._wheel.kind === "colour" &&
      this._wheel.members &&
      this._wheel.members.includes(id)
    )
      return [this._wheel.hue as number, this._wheel.sat as number];
    const held = this._cHold.get(id);
    const hs = this._lHs(id);
    if (held) {
      const landed =
        this._hueDiff(hs[0], held.h) <= 4 && Math.abs(hs[1] - held.s) <= 4;
      if (landed || Date.now() > held.exp) this._cHold.delete(id);
      else return [held.h, held.s];
    }
    return hs;
  }

  // Displayed kelvin for a lamp on the Warm strip (same hold logic).
  private _dispK(id: string): number {
    if (
      this._wheel.dragging &&
      this._wheel.kind === "warm" &&
      this._wheel.members &&
      this._wheel.members.includes(id)
    )
      return this._wheel.k as number;
    const held = this._kHold.get(id);
    const k = this._lKelvin(id);
    if (held) {
      if ((k != null && Math.abs(k - held.k) <= 60) || Date.now() > held.exp)
        this._kHold.delete(id);
      else return held.k;
    }
    const [lo, hi] = this._lKRange(id);
    return k != null ? k : Math.round((lo + hi) / 2);
  }

  // The lamp's real rendered colour for a swatch/dot: HA's rgb_color when present
  // (faithful for colour AND warm lamps), else a warm-white for an on lamp with no
  // colour data (e.g. an hs-mode light reporting color_mode "onoff"), else neutral.
  private _swatchColor(id: string): string {
    if (!this._lOn(id)) return "#3a4446";
    const rgb = this._lAttr(id, "rgb_color");
    if (Array.isArray(rgb)) return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    const hs = this._lAttr(id, "hs_color");
    if (Array.isArray(hs))
      return `hsl(${Math.round(hs[0])} ${Math.round(clamp(hs[1], 20, 90))}% 55%)`;
    return "#ffe6c2";
  }

  // --- commits ------------------------------------------------------------------

  private _call(data: Record<string, unknown>, id?: string | string[]): void {
    if (!this.hass) return;
    const entityId = id || this.config.entity;
    Promise.resolve(
      this.hass.callService("light", "turn_on", {
        entity_id: entityId,
        ...data,
      }),
    ).catch(() => {});
  }

  private _callOff(id?: string | string[]): void {
    if (!this.hass) return;
    const entityId = id || this.config.entity;
    Promise.resolve(
      this.hass.callService("light", "turn_off", { entity_id: entityId }),
    ).catch(() => {});
  }

  private _setColour(id: string, h: number, s: number, flush?: boolean): void {
    this._cHold.set(id, { h, s, exp: Date.now() + 2500 });
    this._colourCommit!({ id, h, s });
    if (flush) this._colourCommit!.flush();
  }

  private _setKelvin(id: string, k: number, flush?: boolean): void {
    const [lo, hi] = this._lKRange(id);
    const v = clamp(k, lo, hi);
    this._kHold.set(id, { k: v, exp: Date.now() + 2500 });
    this._warmCommit!({ id, k: v });
    if (flush) this._warmCommit!.flush();
  }

  // Swatch / "all" helper — apply one service call to every lamp (or the active one).
  private _applyAll(data: Record<string, unknown>): void {
    if (this._room()) this._lamps().forEach((id) => this._call(data, id));
    else this._call(data);
  }

  private _toggle(id?: string): void {
    const target = id || this.config.entity;
    if (!this.hass || this._lUnavail(target)) return;
    // Turning the active lamp off: drop its brightness hold so no stale % lingers.
    if (target === this.config.entity && this._lOn(target))
      this._sl.bri.hold.clear();
    this.hass.callService("light", "toggle", { entity_id: target });
  }

  // Make a lamp the active one (brightness/temp sliders + swatches + keyboard).
  private _selectActive(id: string): void {
    if (!id || id === this.config.entity) return;
    Object.values(this._sl || {}).forEach((s) => s.hold.clear());
    this.config = { ...this.config, entity: id };
    this._v++;
  }

  // --- brightness / temperature sliders (active lamp) ---------------------------

  private _pct(key: string): number {
    const s = this._sl[key];
    let raw = 0;
    if (key === "bri")
      raw = Math.round(((Number(this._attr("brightness")) || 0) / 255) * 100);
    else if (key === "temp") {
      const [lo, hi] = this._kRange();
      const k = Number(this._attr("color_temp_kelvin"));
      raw = Number.isFinite(k)
        ? clamp(((k - lo) / (hi - lo)) * 100, 0, 100)
        : 50;
    } else if (key === "grp") {
      // Room average — only lamps that report a brightness feed it; an on/off lamp
      // would inject a phantom 100% and drag the slider up (mirrors light-group).
      let sum = 0;
      let withBrightness = 0;
      let on = 0;
      this._lamps().forEach((id) => {
        if (!this._lOn(id)) return;
        on += 1;
        const b = this._lAttr(id, "brightness");
        if (b != null) {
          sum += Math.round((Number(b) / 255) * 100);
          withBrightness += 1;
        }
      });
      if (withBrightness) raw = Math.round(sum / withBrightness);
      else raw = on ? 100 : 0;
    }
    return Math.round(
      s.hold.value(raw, {
        dragging: s.dragging,
        dragValue: s.dragPct,
        // Only unavailable = gone; an off lamp still holds its dragged value so
        // dragging it on doesn't snap 60→0→60 during the turn-on round trip.
        gone: key === "grp" ? this._allUnavail() : this._unavail(),
      }),
    );
  }

  private _slider(
    key: string,
    label: string,
    valueText: string,
    opts: { gradient?: string; disabled?: boolean } = {},
  ): TemplateResult {
    const s = this._sl[key];
    const pct = this._pct(key);
    // Off is not disabled — parity with light-row. Only an unavailable lamp is
    // disabled (dragging an off lamp turns it on; drag to zero turns it off).
    const disabled = opts.disabled ?? this._unavail();
    return html`<div class="grid gap-1.5">
      <div class="flex items-center justify-between text-[11px]">
        <span class="font-medium uppercase tracking-[0.1em] text-muted"
          >${label}</span
        >
        <span class="tabular-nums text-ink2">${disabled ? "" : valueText}</span>
      </div>
      ${sliderTrack({
        pct,
        disabled,
        dragging: s.dragging,
        gradient: opts.gradient,
        label,
        value: pct,
        min: 0,
        max: 100,
        step: 5,
        valueText,
        onInput: (v) => {
          const p = Math.round(v);
          s.hold.hold(p);
          s.debounced(p);
        },
        onDown: s.drag.down,
        onMove: s.drag.move,
        onUp: s.drag.up,
        onCancel: s.drag.cancel,
      })}
    </div>`;
  }

  private _swatches(hl: unknown): TemplateResult {
    const btn = (
      bg: string,
      aria: string,
      onClick: () => void,
    ): TemplateResult =>
      html`<button
        type="button"
        aria-label=${aria}
        class="fib-hit h-8 w-8 flex-none rounded-full border border-[rgba(255,255,255,.15)]
             shadow-[0_1px_3px_rgba(0,0,0,.4)] transition-transform active:scale-90"
        style="background:${bg}"
        @click=${onClick}
      ></button>`;
    const anyTemp = this._lamps().some((id) => this._lHasTemp(id));
    const anyColour = this._lamps().some((id) => this._lHasColor(id));
    return html`<div class="lamp-scroll flex gap-2 overflow-x-auto pb-1">
      ${
        anyTemp
          ? WHITES.map((w) =>
              btn(w.css, `${t(hl, `light_detail.${w.key}`)} (${w.k}K)`, () =>
                this._applyAll({ color_temp_kelvin: w.k }),
              ),
            )
          : ""
      }
      ${
        anyColour
          ? HUES.map((h) =>
              btn(
                `hsl(${h} 90% 55%)`,
                `${t(hl, "light_detail.colour")} ${h}°`,
                () => this._applyAll({ hs_color: [h, 90] }),
              ),
            )
          : ""
      }
    </div>`;
  }

  // --- one wheel: colour lamps by hue/saturation, warm-only lamps by kelvin radius,
  //     warm-white centre; each on lamp is a draggable icon marker. ---------------

  // Warm-only = on + colour-temperature-capable but not a colour lamp (no hs_color).
  private _warmOnlyLamps(): string[] {
    const colour = this._colourLamps();
    return this._lamps().filter(
      (id) => this._lOn(id) && this._lHasTemp(id) && !colour.includes(id),
    );
  }

  // Every on lamp that gets a marker (colour lamps first, then warm-only).
  private _wheelLamps(): string[] {
    return [...this._colourLamps(), ...this._warmOnlyLamps()];
  }

  private _isWarm(id: string): boolean {
    return !this._colourLamps().includes(id);
  }

  // --- grouping: a "unit" is one solo lamp or a group of lamps that move as one --
  private _unitOf(id: string): Set<string> | null {
    return this._groups.find((g) => g.has(id)) || null;
  }

  // The on lamps that a drag/keyboard commit should drive for `id`.
  private _members(id: string): string[] {
    const g = this._unitOf(id);
    return g ? [...g].filter((m) => this._lOn(m)) : [id];
  }

  // One entry per marker to draw: each group (as a unit) + each ungrouped lamp.
  private _units(): WheelUnit[] {
    const wheel = this._wheelLamps();
    const inWheel = new Set(wheel);
    const seen = new Set<string>();
    const units: WheelUnit[] = [];
    for (const id of wheel) {
      if (seen.has(id)) continue;
      const g = this._unitOf(id);
      const members = g ? [...g].filter((m) => inWheel.has(m)) : [id];
      members.forEach((m) => seen.add(m));
      const colourRep = members.find((m) => !this._isWarm(m));
      units.push({ rep: colourRep || members[0], members, warm: !colourRep });
    }
    return units;
  }

  // Merge every group overlapping `ids` (plus the solo ids) into one group.
  private _mergeIds(ids: string[]): Set<string> {
    const merged = new Set(ids);
    const keep: Set<string>[] = [];
    for (const g of this._groups) {
      if ([...g].some((m) => merged.has(m))) g.forEach((m) => merged.add(m));
      else keep.push(g);
    }
    keep.push(merged);
    this._groups = keep;
    return merged;
  }

  // Remove `id` from its group (tapping a tile un-snaps it) and focus it.
  private _ungroupAndSelect(id: string): void {
    const g = this._unitOf(id);
    if (g) {
      g.delete(id);
      this._groups = this._groups.filter((s) => s.size > 1);
    }
    if (id !== this.config.entity) {
      Object.values(this._sl || {}).forEach((s) => s.hold.clear());
      this.config = { ...this.config, entity: id };
    }
    this._v++;
  }

  // A small count badge for a grouped lamp (tile corner / wheel marker).
  private _groupBadge(id: string): TemplateResult | string {
    const g = this._unitOf(id);
    const n = g ? [...g].filter((m) => this._lOn(m)).length : 0;
    if (n < 2) return "";
    return html`<span
      class="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center
             rounded-full bg-accent px-0.5 text-[9px] font-bold leading-none text-[#0c1510]"
      >${n}</span
    >`;
  }

  // Marker centre (0-100% of the disc): colour by hue/sat, warm on the warm track.
  private _colourXY(id: string): { x: number; y: number } {
    const [h, s] = this._dispHs(id);
    const rad = (h * Math.PI) / 180;
    return {
      x: 50 + (s / 100) * 50 * Math.sin(rad),
      y: 50 - (s / 100) * 50 * Math.cos(rad),
    };
  }

  private _warmFrac(id: string): number {
    return clamp((this._dispK(id) - STRIP_LO) / (STRIP_HI - STRIP_LO), 0, 1);
  }

  // Colour temperature is not a hue — it's a warm→white→cool path near the centre.
  // So warm lamps ride a horizontal track across the disc centre: warm (2000 K) at
  // the left, cool (6535 K) at the right; only x carries the value.
  private _warmXY(id: string): { x: number; y: number } {
    return { x: TRACK_X0 + this._warmFrac(id) * TRACK_W, y: 50 };
  }

  // Pointer x → kelvin fraction along the warm track (y is ignored).
  private _warmFracAt(clientX: number, rect: DOMRect): number {
    return clamp(
      (clientX - rect.left - (TRACK_X0 / 100) * rect.width) /
        ((TRACK_W / 100) * rect.width),
      0,
      1,
    );
  }

  // Pointer → hue°/sat% (no snap — grouping happens on release, in _wheelUp).
  private _colourAt(e: PointerEvent, R: number): [number, number] {
    const r = (e.currentTarget as Element).getBoundingClientRect();
    const dx = e.clientX - (r.left + R);
    const dy = e.clientY - (r.top + R);
    let hue = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (hue < 0) hue += 360;
    const sat = clamp((Math.hypot(dx, dy) / R) * 100, 0, 100);
    return [hue, sat];
  }

  private _unitXY(u: WheelUnit): { x: number; y: number } {
    return u.warm ? this._warmXY(u.rep) : this._colourXY(u.rep);
  }

  // Apply a colour target to a set of lamps: colour lamps take the hs, warm lamps
  // take the nearest colour temperature (so a mixed group tracks the drag).
  private _commitColour(
    members: string[],
    hue: number,
    sat: number,
    flush?: boolean,
  ): void {
    const k = clamp(
      Math.round(rgbToKelvin(hsToRgb(hue, sat))),
      STRIP_LO,
      STRIP_HI,
    );
    members.forEach((id) => {
      if (this._isWarm(id)) this._setKelvin(id, k, flush);
      else this._setColour(id, hue, sat, flush);
    });
  }

  // Grab the nearest unit marker, then drag the whole unit (a lamp or a group).
  private _wheelDown(e: PointerEvent): void {
    const units = this._units();
    if (!units.length) return;
    const r = (e.currentTarget as Element).getBoundingClientRect();
    const distTo = (u: WheelUnit): number => {
      const p = this._unitXY(u);
      return Math.hypot(
        e.clientX - (r.left + (p.x / 100) * r.width),
        e.clientY - (r.top + (p.y / 100) * r.height),
      );
    };
    let best: WheelUnit | null = null;
    let bestD = Infinity;
    for (const u of units) {
      const d = distTo(u);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    // Prefer the focused lamp's unit when the pointer lands on it.
    const au = units.find((u) => u.members.includes(this.config.entity));
    if (au && distTo(au) <= 22) best = au;
    if (!best) return;
    capturePointer(e.currentTarget as Element, e.pointerId);
    this._wheel = {
      kind: best.warm ? "warm" : "colour",
      warm: best.warm,
      members: best.members,
      dragging: true,
      hue: 0,
      sat: 0,
      k: this._dispK(best.rep),
    };
    this._selectActive(best.rep);
    this._wheelMove(e);
  }

  private _wheelMove(e: PointerEvent, final?: boolean): void {
    if (!this._wheel.dragging) return;
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const R = rect.width / 2;
    if (R <= 0) return;
    if (this._wheel.kind === "warm") {
      const frac = this._warmFracAt(e.clientX, rect);
      const k = Math.round(STRIP_LO + frac * (STRIP_HI - STRIP_LO));
      this._wheel.k = k;
      this._v++;
      this._wheel.members.forEach((id) => this._setKelvin(id, k, final));
    } else {
      const [hue, sat] = this._colourAt(e, R);
      this._wheel.hue = hue;
      this._wheel.sat = sat;
      this._v++;
      this._commitColour(this._wheel.members, hue, sat, final);
    }
  }

  private _wheelUp(e: PointerEvent): void {
    if (!this._wheel.dragging) return;
    this._wheelMove(e, true);
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    // The dragged unit's marker centre (from the live drag state).
    let dp: { x: number; y: number };
    if (this._wheel.kind === "warm") {
      dp = {
        x:
          TRACK_X0 +
          clamp(
            ((this._wheel.k as number) - STRIP_LO) / (STRIP_HI - STRIP_LO),
            0,
            1,
          ) *
            TRACK_W,
        y: 50,
      };
    } else {
      const rad = ((this._wheel.hue as number) * Math.PI) / 180;
      const s = this._wheel.sat as number;
      dp = {
        x: 50 + (s / 100) * 50 * Math.sin(rad),
        y: 50 - (s / 100) * 50 * Math.cos(rad),
      };
    }
    const dcx = rect.left + (dp.x / 100) * rect.width;
    const dcy = rect.top + (dp.y / 100) * rect.height;
    const dragged = new Set(this._wheel.members);
    let target: WheelUnit | null = null;
    for (const u of this._units()) {
      if (u.members.some((m) => dragged.has(m))) continue;
      const p = this._unitXY(u);
      const d = Math.hypot(
        dcx - (rect.left + (p.x / 100) * rect.width),
        dcy - (rect.top + (p.y / 100) * rect.height),
      );
      if (d <= SNAP_PX + 12) {
        target = u;
        break;
      }
    }
    this._wheel.dragging = false;
    if (target) {
      // Merge the two units into one group; unify every on member at the drop.
      const merged = this._mergeIds([
        ...this._wheel.members,
        ...target.members,
      ]);
      const on = [...merged].filter((id) => this._lOn(id));
      if (this._wheel.kind === "warm")
        on.forEach((id) => this._setKelvin(id, this._wheel.k as number, true));
      else
        this._commitColour(
          on,
          this._wheel.hue as number,
          this._wheel.sat as number,
          true,
        );
    }
    this._v++;
  }

  private _dragCancel(): void {
    this._wheel.dragging = false;
    this._v++;
  }

  // Arrows nudge the active lamp's whole unit — hue/sat for colour, kelvin for warm.
  private _wheelKey(e: KeyboardEvent): void {
    const id = this.config.entity;
    if (!this._lOn(id) || !this._wheelLamps().includes(id)) return;
    const members = this._members(id);
    if (this._isWarm(id)) {
      const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[
        e.key
      ];
      if (!dir) return;
      e.preventDefault();
      const k = clamp(
        (this._dispK(id) || STRIP_LO) + (e.shiftKey ? 500 : 100) * dir,
        STRIP_LO,
        STRIP_HI,
      );
      members.forEach((m) => this._isWarm(m) && this._setKelvin(m, k, true));
    } else {
      const d = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, 1],
        ArrowDown: [0, -1],
      }[e.key];
      if (!d) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 2;
      const [ch, cs] = this._dispHs(id);
      const hue = (((ch + d[0] * step) % 360) + 360) % 360;
      const sat = clamp(cs + d[1] * step, 0, 100);
      this._commitColour(members, hue, sat, true);
    }
    this._v++;
  }

  private _wheelDisc(hl: unknown): TemplateResult {
    const lamps = this._wheelLamps();
    const disabled = !lamps.length;
    const active = this.config.entity;
    let activeText = "";
    if (this._isWarm(active)) {
      activeText = `${Math.round(this._dispK(active) || 0)} K`;
    } else {
      const [ah, as] = this._dispHs(active);
      activeText = `${Math.round(ah)}°, ${Math.round(as)}%`;
    }
    // The wheel is a 2D hue/saturation picker, not a linear slider, so it carries
    // aria-valuetext (e.g. "210°, 80%") rather than a single aria-valuenow.
    // eslint-disable-next-line lit-a11y/role-has-required-aria-attrs
    return html`<div
      class="relative mx-auto aspect-square w-full max-w-[280px] touch-none select-none
             rounded-full ${disabled ? "pointer-events-none opacity-40" : "cursor-pointer"}"
      style="background:radial-gradient(circle at center,#ffe9c8 0%,rgba(255,233,200,0) 62%),
             conic-gradient(from 0deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)"
      role="slider"
      tabindex=${disabled ? -1 : 0}
      aria-label=${t(hl, "light_detail.colour")}
      aria-valuetext=${activeText}
      aria-disabled=${disabled ? "true" : "false"}
      @pointerdown=${this._wheelDown}
      @pointermove=${this._wheelMove}
      @pointerup=${this._wheelUp}
      @pointercancel=${this._dragCancel}
      @lostpointercapture=${this._dragCancel}
      @keydown=${this._wheelKey}
    >
      ${
        this._warmOnlyLamps().length
          ? html`<div
              class="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-70"
              style="left:${TRACK_X0}%;width:${TRACK_W}%;background:linear-gradient(90deg,#ff9838,#ffd9a0,#fff6ea,#e6efff,#bcd2ff)"
            ></div>`
          : ""
      }
      ${this._units().map((u) => {
        const p = this._unitXY(u);
        const isActive = u.members.includes(active);
        const icon =
          (this._lAttr(u.rep, "icon") as string) ||
          "solar:lightbulb-bold-duotone";
        const count = u.members.length;
        return html`<div
          class="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center
                 justify-center rounded-full border shadow-[0_2px_6px_rgba(0,0,0,.55)]
                 ${
                   isActive
                     ? "h-9 w-9 border-2 border-accent ring-2 ring-accent"
                     : "h-8 w-8 border-[rgba(0,0,0,.35)]"
                 }"
          style="left:${p.x}%;top:${p.y}%;background:${this._swatchColor(u.rep)}"
        >
          <fib-icon
            class="h-4 w-4 [--mdc-icon-size:16px] text-white
                   drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
            icon=${icon}
          ></fib-icon>
          ${
            count > 1
              ? html`<span
                  class="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center
                         justify-center rounded-full bg-accent px-0.5 text-[9px] font-bold
                         leading-none text-[#0c1510] shadow-[0_1px_2px_rgba(0,0,0,.6)]"
                  >${count}</span
                >`
              : ""
          }
        </div>`;
      })}
    </div>`;
  }

  // --- room picker (one wheel + brightness + swatches + lamp tiles) -------------

  // Equal square tiles in a horizontal scroll: each shows the lamp's real colour,
  // an instant on/off toggle, and its name; tapping a tile focuses that lamp for the
  // colour/warm picker (active = accent border).
  private _lampTiles(hl: unknown): TemplateResult {
    const active = this.config.entity;
    return html`<div
      class="lamp-tiles lamp-scroll flex gap-2 overflow-x-auto pb-1"
    >
      ${this._lamps().map((id) => {
        const on = this._lOn(id);
        const unavail = this._lUnavail(id);
        const nm = (this._lAttr(id, "friendly_name") as string) || id;
        const isActive = id === active;
        const icon =
          (this._lAttr(id, "icon") as string) || "solar:lightbulb-bold-duotone";
        // Button-underlay: a full-size transparent select button sits behind the
        // (pointer-events-none) content, and the toggle re-enables its own pointer
        // events on top — so there are no nested interactive elements.
        return html`<div
          class="relative flex h-[84px] w-[104px] flex-none rounded-[14px] border
                 p-2.5 transition-colors
                 ${
                   isActive
                     ? "border-accent bg-accentbg"
                     : "border-line bg-card2"
                 } ${unavail ? "opacity-50" : ""}"
        >
          <button
            type="button"
            class="absolute inset-0 cursor-pointer rounded-[14px]"
            aria-pressed=${isActive ? "true" : "false"}
            aria-label=${nm}
            @click=${() => this._ungroupAndSelect(id)}
            @keydown=${activateOnKey(() => this._ungroupAndSelect(id))}
          ></button>
          <div
            class="pointer-events-none relative flex h-full w-full flex-col justify-between"
          >
            <div class="flex items-start justify-between gap-1">
              <span
                class="relative flex h-8 w-8 flex-none items-center justify-center rounded-full
                       border border-[rgba(0,0,0,.3)] shadow-[0_1px_3px_rgba(0,0,0,.4)]"
                style="background:${this._swatchColor(id)}"
              >
                <fib-icon
                  class="h-4 w-4 [--mdc-icon-size:16px] text-white
                         drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
                  icon=${icon}
                ></fib-icon>
                ${this._groupBadge(id)}
              </span>
              ${
                unavail
                  ? html`<span class="text-[9px] uppercase text-muted"
                      >${t(hl, "light_detail.offline")}</span
                    >`
                  : html`<span class="pointer-events-auto"
                      >${pillSwitch({
                        on,
                        label: nm,
                        onClick: () => this._toggle(id),
                      })}</span
                    >`
              }
            </div>
            <span
              class="truncate text-[11px] ${isActive ? "font-medium text-ink" : "text-ink2"}"
              >${nm}</span
            >
          </div>
        </div>`;
      })}
    </div>`;
  }

  private _roomPicker(hl: unknown): TemplateResult {
    return html`
      <div class="room-layout grid gap-4">
        <div class="min-w-0">${this._wheelDisc(hl)}</div>
        <div class="grid min-w-0 gap-4">
          ${this._slider(
            "bri",
            `${t(hl, "light_detail.brightness")} · ${(this._lAttr(this.config.entity, "friendly_name") as string) || ""}`,
            `${this._pct("bri")}%`,
          )}
          ${this._lampTiles(hl)}
        </div>
      </div>
    `;
  }

  // --- single-light layout ------------------------------------------------------

  private _singleControls(hl: unknown): TemplateResult {
    const [lo, hi] = this._kRange();
    const curK = Math.round(lo + (this._pct("temp") / 100) * (hi - lo));
    let colourOrTemp: TemplateResult | string = "";
    if (this._hasColor()) colourOrTemp = this._wheelDisc(hl);
    else if (this._hasTemp())
      colourOrTemp = this._slider(
        "temp",
        t(hl, "light_detail.temperature"),
        `${curK} K`,
        {
          gradient:
            "linear-gradient(90deg,#ff9838,#ffd9a0,#fff6ea,#e6efff,#bcd2ff)",
        },
      );
    return html`
      ${this._slider("bri", t(hl, "light_detail.brightness"), `${this._pct("bri")}%`)}
      ${colourOrTemp}
      ${this._hasTemp() || this._hasColor() ? this._swatches(hl) : ""}
    `;
  }

  // Room top bar — back on the left, the whole-room brightness beside it, and a
  // hairline under both.
  private _renderRoomBar(hl: unknown): TemplateResult {
    const cfg = this.config;
    const title = cfg.groupName || cfg.title || t(hl, "light_detail.lights");
    return html`<div class="grid gap-3.5">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="flex h-9 w-9 flex-none items-center justify-center rounded-lg
                 bg-card2 text-ink2 transition-colors hover:text-ink"
          aria-label=${t(hl, "back.back")}
          @click=${() => closeSheet()}
        >
          <fib-icon
            class="h-[18px] w-[18px] [--mdc-icon-size:18px]"
            icon="solar:alt-arrow-left-bold-duotone"
          ></fib-icon>
        </button>
        <div class="min-w-0 flex-1">
          ${this._slider("grp", title, `${this._pct("grp")}%`, {
            disabled: this._allUnavail(),
          })}
        </div>
      </div>
      <div class="border-t border-line"></div>
    </div>`;
  }

  private _renderHeader(hl: unknown, on: boolean): TemplateResult {
    const cfg = this.config;
    const st = this._st();
    const unavail = this._unavail();
    const title = cfg.name || (st && st.attributes.friendly_name) || cfg.entity;
    const icon =
      cfg.icon || (st && st.attributes.icon) || "solar:lightbulb-bold-duotone";
    let subtitle: string;
    if (unavail) subtitle = t(hl, "light_detail.offline");
    else if (on) subtitle = t(hl, "light_detail.on");
    else subtitle = t(hl, "light_detail.off");

    return html`<div class="flex items-center gap-3">
      <div
        class="${cx(
          "flex h-9 w-9 flex-none items-center justify-center rounded-xl",
          on ? "bg-accentbg text-accent" : "bg-card2 text-muted",
        )}"
      >
        <fib-icon
          class="h-[20px] w-[20px] [--mdc-icon-size:20px]"
          icon=${icon}
        ></fib-icon>
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-[14px] font-semibold text-ink">${title}</div>
        <div class="text-[11px] text-muted">${subtitle}</div>
      </div>
      ${pillSwitch({
        on,
        label: t(hl, "light_detail.power"),
        onClick: () => this._toggle(),
      })}
    </div>`;
  }

  /** Room: back + group slider then the picker. Single: header + controls. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const unavail = this._unavail();
    const room = this._room();
    let body: TemplateResult | string;
    if (room) body = this._roomPicker(hl);
    else if (unavail) body = "";
    else body = this._singleControls(hl);

    const head = room
      ? this._renderRoomBar(hl)
      : this._renderHeader(hl, this._on());
    return cardShell(html`${head} ${body}`, {
      pad: "lg",
      cls: cx("grid gap-4", !room && unavail && "opacity-60"),
    });
  }

  /** Masonry height — header + picker + swatches + lamp list. */
  getCardSize(): number {
    return 5;
  }

  /** Sections view: full width, auto height. */
  getLayoutOptions(): { grid_columns: string; grid_rows: string } {
    return { grid_columns: "full", grid_rows: "auto" };
  }

  /** Grid view: auto. */
  getGridOptions(): { columns: string; rows: string } {
    return { columns: "full", rows: "auto" };
  }
}
