/* ================================================================== *
 * fibbers-light-detail — the full light control used by the more-info modal.
 * Single light: brightness, a warm→cool temperature slider, a colour wheel and
 * quick swatches. Opened from a room/group (siblings): a Philips-Hue-style room
 * picker — one warm-centred wheel carrying a draggable icon marker per lamp
 * (colour lamps by hue/saturation, warm-only lamps by kelvin radius; drag a marker
 * onto another to snap them together), brightness + swatches, and the lamps as
 * tiles below.
 *
 * This file is the thin element: HA/card wiring, the brightness/temp/group value
 * sliders (shared setupSlider pipeline), and render glue. The colour/warm wheel +
 * grouping state machine lives in the WheelController (light-detail-wheel.ts); the
 * presentational fragments in light-detail-views.ts; the pure geometry + lamp
 * accessors in light-detail-math.ts / light-detail-lamps.ts.
 * ================================================================== */
import { LitElement, html, unsafeCSS, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { t } from "@shared/i18n";
import { cardShell } from "@shared/shells";
import { twSheet } from "@shared/tw";
import { ThemeController } from "@shared/theme-host";
import { setupSlider, type SliderController } from "@shared/ui";
import { pctFromX, brightnessPct, clamp, pickEntity } from "@shared/util";
import { cx } from "@shared/variants";
import type {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
} from "@/types/home-assistant";
// Wheel/scrollbar/container-query CSS — real CSS, co-located; Vite inlines it.
import lightDetailCss from "./light-detail.css?inline";

import { WheelController } from "./light-detail-wheel";
import {
  lampState,
  lampAttr,
  lampOn,
  lampUnavail,
  lampKRange,
  lampHasColor,
  lampHasTemp,
} from "./light-detail-lamps";
import {
  renderHeader,
  renderRoomBar,
  sliderRow,
  swatches,
  wheelDisc,
  lampTiles,
  type LightDetailHost,
} from "./light-detail-views";

/** YAML/editor config accepted by `fibbers-light-detail`. */
export interface LightDetailConfig extends LovelaceCardConfig {
  entity: string;
  name?: string;
  icon?: string;
  title?: string;
  groupName?: string;
  siblings?: string[];
}

/**
 * fibbers-light-detail — a full light control (brightness, temperature, a colour
 * wheel, swatches) and, when opened for a room/group, a multi-lamp room picker.
 */
@customElement("fibbers-light-detail")
export class FibbersLightDetail
  extends LitElement
  implements LovelaceCard, LightDetailHost
{
  @property({ attribute: false }) hass?: HomeAssistant;

  _theme = new ThemeController(this);

  @state() config!: LightDetailConfig;

  private _sl: Record<string, SliderController> = {};

  /** The colour/warm wheel + ephemeral grouping engine (a ReactiveController). */
  readonly wheel = new WheelController(this);

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

  /** Validate + build the brightness/temperature/group slider controllers. */
  setConfig(config: LightDetailConfig): void {
    if (!config || !config.entity || !config.entity.startsWith("light.")) {
      throw new Error("fibbers-light-detail: `entity` must be a light.*");
    }
    this.config = config;
    // Brightness + temperature keep the shared slider pipeline (active lamp).
    this._sl = this._sl || {};
    this._mk("bri", (pct) => {
      const p = Math.round(pct);
      // Drives the focused lamp's whole colour-group (a solo lamp is a group of one).
      const ids = this.wheel.membersOf(this.config.entity);
      // Mirror light-row: dragging to zero turns the lamp off, not turn_on 0%.
      if (p <= 0) this._callOff(ids);
      else this.call({ brightness_pct: p }, ids);
    });
    this._mk("temp", (pct) => {
      const [lo, hi] = this._kRange();
      this.call({
        color_temp_kelvin: Math.round(lo + (pct / 100) * (hi - lo)),
      });
    });
    // Room bar: one slider driving every lamp at once (mirrors light-group).
    this._mk(
      "grp",
      (pct) => {
        const p = Math.round(pct);
        if (p <= 0) this._callOff(this.lamps());
        else this.call({ brightness_pct: p }, this.lamps());
      },
      () => this.allUnavail(),
    );
    // Ephemeral colour groups reset when the room's lamps change.
    const sig = Array.isArray(config.siblings)
      ? config.siblings.join(",")
      : config.entity;
    this.wheel.reset(sig);
  }

  private _mk(
    key: string,
    commit: (v: number) => void,
    guard?: () => boolean,
  ): void {
    // Construct once and reuse (a fresh SliderHold per setConfig would stack
    // controllers on the host); the commit closure reads live state, so a
    // re-config needs no rebuild.
    if (this._sl[key]) {
      this._sl[key].hold.clear();
      return;
    }
    this._sl[key] = setupSlider({
      host: this,
      guard: guard || (() => this.unavail()),
      read: (e) => Math.round(pctFromX(e.clientX, e.currentTarget as Element)),
      base: () => this.pct(key),
      commit,
      debounceMs: 120,
      hold: { tolerance: 2, timeout: 2500 },
    });
  }

  /** Cancel pending slider writes on unmount (the wheel cleans up its own). */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    Object.values(this._sl || {}).forEach((s) => s.dispose());
  }

  // --- host contract (WheelHost + LightDetailHost) ------------------------------

  /** Lamp set: the room's live siblings, else just this light. */
  lamps(): string[] {
    const ids = this.config.siblings;
    const live = Array.isArray(ids)
      ? ids.filter((id) => lampState(this.hass, id))
      : [this.config.entity];
    return live.length ? live : [this.config.entity];
  }

  /** The focused lamp — brightness/temp sliders + swatches + keyboard drive it. */
  get active(): string {
    return this.config.entity;
  }

  /** The brightness/temp/group slider controller for a key. */
  slider(key: string): SliderController {
    return this._sl[key];
  }

  /** True when the active lamp is unavailable (disables its sliders). */
  unavail(): boolean {
    return lampUnavail(this.hass, this.config.entity);
  }

  /** The whole room is gone only when every lamp is — gates the group slider. */
  allUnavail(): boolean {
    return this.lamps().every((id) => lampUnavail(this.hass, id));
  }

  private _room(): boolean {
    return this.lamps().length > 1;
  }

  private _kRange(): [number, number] {
    return lampKRange(this.hass, this.config.entity);
  }

  /** `light.turn_on` with `data` on one or many entities. */
  call(data: Record<string, unknown>, id?: string | string[]): void {
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

  /** Swatch / "all" helper — apply one service call to every lamp (or the active one). */
  applyAll(data: Record<string, unknown>): void {
    if (this._room()) this.lamps().forEach((id) => this.call(data, id));
    else this.call(data);
  }

  /** Toggle a lamp (or the active one), dropping its stale brightness hold. */
  toggle(id?: string): void {
    const target = id || this.config.entity;
    if (!this.hass || lampUnavail(this.hass, target)) return;
    // Turning the active lamp off: drop its brightness hold so no stale % lingers.
    if (target === this.config.entity && lampOn(this.hass, target))
      this._sl.bri.hold.clear();
    this.hass.callService("light", "toggle", { entity_id: target });
  }

  /** Make a lamp the active one (brightness/temp sliders + swatches + keyboard). */
  selectActive(id: string): void {
    if (id && id !== this.config.entity) {
      Object.values(this._sl || {}).forEach((s) => s.hold.clear());
      this.config = { ...this.config, entity: id };
    }
    this.requestUpdate();
  }

  // --- brightness / temperature / group sliders (value mapping) -----------------

  /** The displayed 0–100 value for a slider key (bri/temp/grp), holds applied. */
  pct(key: string): number {
    const s = this._sl[key];
    const active = this.config.entity;
    let raw = 0;
    if (key === "bri") {
      // Average brightness of the focused colour-group (mirrors the room slider);
      // only on lamps that report a brightness feed it, else 100/0.
      let sum = 0;
      let withBrightness = 0;
      let on = 0;
      this.wheel.membersOf(active).forEach((id) => {
        if (!lampOn(this.hass, id)) return;
        on += 1;
        if (lampAttr(this.hass, id, "brightness") != null) {
          sum += brightnessPct(lampState(this.hass, id));
          withBrightness += 1;
        }
      });
      if (withBrightness) raw = Math.round(sum / withBrightness);
      else raw = on ? 100 : 0;
    } else if (key === "temp") {
      const [lo, hi] = this._kRange();
      const k = Number(lampAttr(this.hass, active, "color_temp_kelvin"));
      raw = Number.isFinite(k)
        ? clamp(((k - lo) / (hi - lo)) * 100, 0, 100)
        : 50;
    } else if (key === "grp") {
      // Room average — only lamps that report a brightness feed it; an on/off lamp
      // would inject a phantom 100% and drag the slider up (mirrors light-group).
      let sum = 0;
      let withBrightness = 0;
      let on = 0;
      this.lamps().forEach((id) => {
        if (!lampOn(this.hass, id)) return;
        on += 1;
        if (lampAttr(this.hass, id, "brightness") != null) {
          sum += brightnessPct(lampState(this.hass, id));
          withBrightness += 1;
        }
      });
      if (withBrightness) raw = Math.round(sum / withBrightness);
      else raw = on ? 100 : 0;
    }
    // Only unavailable = gone; an off lamp still holds its dragged value so
    // dragging it on doesn't snap 60→0→60 during the turn-on round trip.
    return Math.round(
      s.value(raw, key === "grp" ? this.allUnavail() : this.unavail()),
    );
  }

  // --- layouts ------------------------------------------------------------------

  private _roomPicker(hl: unknown): TemplateResult {
    // The brightness slider drives the focused colour-group — label it accordingly.
    const ids = this.wheel.membersOf(this.config.entity);
    const bri = t(hl, "light_detail.brightness");
    const label =
      ids.length > 1
        ? `${bri} · ${t(hl, "light_detail.n_lamps", { n: ids.length })}`
        : `${bri} · ${(lampAttr(this.hass, this.config.entity, "friendly_name") as string) || ""}`;
    return html`
      <div class="room-layout grid gap-4">
        <div class="min-w-0">${wheelDisc(this, hl)}</div>
        <div class="grid min-w-0 gap-4">
          ${sliderRow(this, "bri", label, `${this.pct("bri")}%`)}
          ${lampTiles(this, hl)}
        </div>
      </div>
    `;
  }

  private _singleControls(hl: unknown): TemplateResult {
    const [lo, hi] = this._kRange();
    const curK = Math.round(lo + (this.pct("temp") / 100) * (hi - lo));
    const hasColor = lampHasColor(this.hass, this.config.entity);
    const hasTemp = lampHasTemp(this.hass, this.config.entity);
    let colourOrTemp: TemplateResult | string = "";
    if (hasColor) colourOrTemp = wheelDisc(this, hl);
    else if (hasTemp)
      colourOrTemp = sliderRow(
        this,
        "temp",
        t(hl, "light_detail.temperature"),
        `${curK} K`,
        {
          gradient:
            "linear-gradient(90deg,#ff9838,#ffd9a0,#fff6ea,#e6efff,#bcd2ff)",
        },
      );
    return html`
      ${sliderRow(this, "bri", t(hl, "light_detail.brightness"), `${this.pct("bri")}%`)}
      ${colourOrTemp} ${hasTemp || hasColor ? swatches(this, hl) : ""}
    `;
  }

  /** Room: back + group slider then the picker. Single: header + controls. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const hl = this.hass;
    const unavail = this.unavail();
    const room = this._room();
    let body: TemplateResult | string;
    if (room) body = this._roomPicker(hl);
    else if (unavail) body = "";
    else body = this._singleControls(hl);

    const head = room
      ? renderRoomBar(this, hl)
      : renderHeader(this, hl, lampOn(this.hass, cfg.entity));
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
