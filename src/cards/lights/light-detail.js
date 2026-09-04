/* ================================================================== *
 * fibbers-light-detail — the full light control used by the more-info modal.
 * Single light: brightness, a warm→cool temperature slider, a colour wheel and
 * quick swatches. Opened from a room/group (siblings): a Philips-Hue-style room
 * picker — one warm-centred wheel carrying a draggable icon marker per lamp
 * (colour lamps by hue/saturation, warm-only lamps by kelvin radius; drag a marker
 * onto another to snap them together), brightness + swatches, and the lamps as
 * tiles below. Reuses the shared slider primitives.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t } from "../../shared/i18n.js";
import { twSheet } from "../../shared/tw.js";
import {
  sliderTrack,
  sliderDrag,
  pillSwitch,
  activateOnKey,
  SliderHold,
} from "../../shared/ui.js";
import {
  pctFromX,
  isUnavail,
  debounce,
  clamp,
  pickEntity,
  capturePointer,
} from "../../shared/util.js";
import "../../shared/icon.js";

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

// --- tiny colour helpers, for committing a group across lamp kinds --------------
// hue°/sat% (full value) → [r,g,b] 0-255.
function hsToRgb(h, s) {
  const sat = s / 100;
  const c = sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = 1 - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
// [r,g,b] → correlated colour temperature (Kelvin), McCamy's approximation. Used
// best-effort so a white lamp in a mixed group tracks a colour drag's warmth.
function rgbToKelvin([r, g, b]) {
  const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 255;
  const Y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
  const Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 255;
  const sum = X + Y + Z || 1;
  const x = X / sum;
  const y = Y / sum;
  const n = (x - 0.332) / (0.1858 - y || 1e-6);
  return 449 * n ** 3 + 3525 * n ** 2 + 6823.3 * n + 5520.33;
}

/**
 * fibbers-light-detail — a full light control (brightness, temperature, a colour
 * wheel, swatches) and, when opened for a room/group, a multi-lamp room picker.
 */
export class FibbersLightDetail extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _v: { state: true }, // bump to force re-render on drag frames
  };

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
        container-type: inline-size;
      }
      /* Wide container (desktop, widened modal) → two columns: wheel | controls. */
      @container (min-width: 700px) {
        .room-layout {
          grid-template-columns: minmax(0, 300px) minmax(0, 1fr);
          align-items: start;
        }
        .lamp-tiles {
          display: grid;
          grid-template-columns: repeat(auto-fill, 104px);
          overflow: visible;
        }
      }
      /* Themed thin scrollbar for the horizontal lamp-tile strip. */
      .lamp-scroll {
        scrollbar-width: thin;
        scrollbar-color: var(--color-line, #333e41) transparent;
      }
      .lamp-scroll::-webkit-scrollbar {
        height: 6px;
      }
      .lamp-scroll::-webkit-scrollbar-track {
        background: transparent;
      }
      .lamp-scroll::-webkit-scrollbar-thumb {
        background: var(--color-line, #333e41);
        border-radius: 3px;
      }
      .lamp-scroll:hover::-webkit-scrollbar-thumb {
        background: var(--color-accent, #74b98a);
      }
    `,
  ];

  /** Seed config for the picker — a light entity from the dashboard. */
  static getStubConfig(hass, entities, entitiesFallback) {
    return {
      type: "custom:fibbers-light-detail",
      entity: pickEntity("light", entities, entitiesFallback, "light.example"),
    };
  }

  /** Validate + build the brightness/temperature slider controllers and drag state. */
  setConfig(config) {
    if (!config || !config.entity || !config.entity.startsWith("light.")) {
      throw new Error("fibbers-light-detail: `entity` must be a light.*");
    }
    this._config = config;
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

  _mk(key, commit) {
    if (this._sl[key]) {
      this._sl[key].hold.clear();
      return;
    }
    const s = { dragging: false, dragPct: 0 };
    s.hold = new SliderHold(this, { tolerance: 2, timeout: 2500 });
    // Arm the hold on every commit so the control holds the committed value until
    // the light reports it (no snap-back to the stale value on release).
    s.debounced = debounce((v) => {
      s.hold.hold(v);
      commit(v);
    }, 120);
    s.drag = sliderDrag({
      guard: () => this._unavail(),
      read: (e) => Math.round(pctFromX(e.clientX, e.currentTarget)),
      frame: (v, dragging) => {
        s.dragging = dragging;
        if (v != null) s.dragPct = v;
        this._v++;
      },
      live: (v) => s.debounced(v),
      end: (v) => {
        if (v == null) return s.debounced.cancel();
        s.debounced(v);
        s.debounced.flush();
      },
    });
    this._sl[key] = s;
  }

  /** Cancel pending writes on unmount. */
  disconnectedCallback() {
    super.disconnectedCallback();
    Object.values(this._sl || {}).forEach((s) => s.debounced.cancel());
    if (this._colourCommit) this._colourCommit.cancel();
    if (this._warmCommit) this._warmCommit.cancel();
  }

  // --- lamp accessors (generic over an entity id) -------------------------------

  _lSt(id) {
    return this.hass && this.hass.states[id];
  }
  _lOn(id) {
    const st = this._lSt(id);
    return !!st && st.state === "on";
  }
  _lUnavail(id) {
    return isUnavail(this._lSt(id));
  }
  _lAttr(id, k) {
    const st = this._lSt(id);
    return st && st.attributes ? st.attributes[k] : undefined;
  }
  _lModes(id) {
    return this._lAttr(id, "supported_color_modes") || [];
  }
  _lHasColor(id) {
    return this._lModes(id).some((m) => COLOR_MODES.includes(m));
  }
  _lHasTemp(id) {
    return this._lModes(id).includes("color_temp");
  }
  _lHs(id) {
    const hs = this._lAttr(id, "hs_color");
    return Array.isArray(hs) ? hs : [0, 0];
  }
  _lKRange(id) {
    const lo = Number(this._lAttr(id, "min_color_temp_kelvin")) || STRIP_LO;
    const hi = Number(this._lAttr(id, "max_color_temp_kelvin")) || STRIP_HI;
    return [lo, hi > lo ? hi : lo + 1];
  }
  _lKelvin(id) {
    const k = Number(this._lAttr(id, "color_temp_kelvin"));
    return Number.isFinite(k) ? k : null;
  }

  // Active-lamp shorthands (the entity the brightness/temp sliders + swatches drive).
  _st() {
    return this._lSt(this._config.entity);
  }
  _unavail() {
    return this._lUnavail(this._config.entity);
  }
  _on() {
    return this._lOn(this._config.entity);
  }
  _attr(k) {
    return this._lAttr(this._config.entity, k);
  }
  _hasTemp() {
    return this._lHasTemp(this._config.entity);
  }
  _hasColor() {
    return this._lHasColor(this._config.entity);
  }
  _kRange() {
    return this._lKRange(this._config.entity);
  }

  // Lamp set: the room's siblings, else just this light.
  _lamps() {
    const ids = this._config.siblings;
    const live = Array.isArray(ids)
      ? ids.filter((id) => this._lSt(id))
      : [this._config.entity];
    return live.length ? live : [this._config.entity];
  }
  _room() {
    return this._lamps().length > 1;
  }
  _colourLamps() {
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

  _hueDiff(a, b) {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }
  // Displayed hue/sat for a lamp: the live drag value while its dot is dragged,
  // else the committed hold until the entity catches up, else the entity value.
  _dispHs(id) {
    if (
      this._wheel.dragging &&
      this._wheel.kind === "colour" &&
      this._wheel.members &&
      this._wheel.members.includes(id)
    )
      return [this._wheel.hue, this._wheel.sat];
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
  _dispK(id) {
    if (
      this._wheel.dragging &&
      this._wheel.kind === "warm" &&
      this._wheel.members &&
      this._wheel.members.includes(id)
    )
      return this._wheel.k;
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
  _swatchColor(id) {
    if (!this._lOn(id)) return "#3a4446";
    const rgb = this._lAttr(id, "rgb_color");
    if (Array.isArray(rgb)) return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    const hs = this._lAttr(id, "hs_color");
    if (Array.isArray(hs))
      return `hsl(${Math.round(hs[0])} ${Math.round(clamp(hs[1], 20, 90))}% 55%)`;
    return "#ffe6c2";
  }

  // --- commits ------------------------------------------------------------------

  _call(data, id) {
    if (!this.hass) return;
    const entity_id = id || this._config.entity;
    Promise.resolve(
      this.hass.callService("light", "turn_on", { entity_id, ...data }),
    ).catch(() => {});
  }
  _callOff(id) {
    if (!this.hass) return;
    const entity_id = id || this._config.entity;
    Promise.resolve(
      this.hass.callService("light", "turn_off", { entity_id }),
    ).catch(() => {});
  }
  _setColour(id, h, s, flush) {
    this._cHold.set(id, { h, s, exp: Date.now() + 2500 });
    this._colourCommit({ id, h, s });
    if (flush) this._colourCommit.flush();
  }
  _setKelvin(id, k, flush) {
    const [lo, hi] = this._lKRange(id);
    const v = clamp(k, lo, hi);
    this._kHold.set(id, { k: v, exp: Date.now() + 2500 });
    this._warmCommit({ id, k: v });
    if (flush) this._warmCommit.flush();
  }
  // Swatch / "all" helper — apply one service call to every lamp (or the active one).
  _applyAll(data) {
    if (this._room()) this._lamps().forEach((id) => this._call(data, id));
    else this._call(data);
  }
  _toggle(id) {
    const target = id || this._config.entity;
    if (!this.hass || this._lUnavail(target)) return;
    // Turning the active lamp off: drop its brightness hold so no stale % lingers.
    if (target === this._config.entity && this._lOn(target))
      this._sl.bri.hold.clear();
    this.hass.callService("light", "toggle", { entity_id: target });
  }
  // Make a lamp the active one (brightness/temp sliders + swatches + keyboard).
  _selectActive(id) {
    if (!id || id === this._config.entity) return;
    Object.values(this._sl || {}).forEach((s) => s.hold.clear());
    this._config = { ...this._config, entity: id };
    this._v++;
  }

  // --- brightness / temperature sliders (active lamp) ---------------------------

  _pct(key) {
    const s = this._sl[key];
    let raw = 0;
    if (key === "bri")
      raw = Math.round(((this._attr("brightness") || 0) / 255) * 100);
    else if (key === "temp") {
      const [lo, hi] = this._kRange();
      const k = Number(this._attr("color_temp_kelvin"));
      raw = Number.isFinite(k)
        ? clamp(((k - lo) / (hi - lo)) * 100, 0, 100)
        : 50;
    }
    return Math.round(
      s.hold.value(raw, {
        dragging: s.dragging,
        dragValue: s.dragPct,
        // Only unavailable = gone; an off lamp still holds its dragged value so
        // dragging it on doesn't snap 60→0→60 during the turn-on round trip.
        gone: this._unavail(),
      }),
    );
  }

  _slider(key, label, valueText, opts = {}) {
    const s = this._sl[key];
    const pct = this._pct(key);
    // Off is not disabled — parity with light-row. Only an unavailable lamp is
    // disabled (dragging an off lamp turns it on; drag to zero turns it off).
    const disabled = this._unavail();
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

  _swatches(hl) {
    const btn = (bg, aria, onClick) =>
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
              btn(w.css, `${t(hl, "light_detail." + w.key)} (${w.k}K)`, () =>
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
  _warmOnlyLamps() {
    const colour = this._colourLamps();
    return this._lamps().filter(
      (id) => this._lOn(id) && this._lHasTemp(id) && !colour.includes(id),
    );
  }
  // Every on lamp that gets a marker (colour lamps first, then warm-only).
  _wheelLamps() {
    return [...this._colourLamps(), ...this._warmOnlyLamps()];
  }
  _isWarm(id) {
    return !this._colourLamps().includes(id);
  }

  // --- grouping: a "unit" is one solo lamp or a group of lamps that move as one --
  _unitOf(id) {
    return this._groups.find((g) => g.has(id)) || null;
  }
  // The on lamps that a drag/keyboard commit should drive for `id`.
  _members(id) {
    const g = this._unitOf(id);
    return g ? [...g].filter((m) => this._lOn(m)) : [id];
  }
  // One entry per marker to draw: each group (as a unit) + each ungrouped lamp.
  _units() {
    const wheel = this._wheelLamps();
    const inWheel = new Set(wheel);
    const seen = new Set();
    const units = [];
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
  _mergeIds(ids) {
    const merged = new Set(ids);
    const keep = [];
    for (const g of this._groups) {
      if ([...g].some((m) => merged.has(m))) g.forEach((m) => merged.add(m));
      else keep.push(g);
    }
    keep.push(merged);
    this._groups = keep;
    return merged;
  }
  // Remove `id` from its group (tapping a tile un-snaps it) and focus it.
  _ungroupAndSelect(id) {
    const g = this._unitOf(id);
    if (g) {
      g.delete(id);
      this._groups = this._groups.filter((s) => s.size > 1);
    }
    if (id !== this._config.entity) {
      Object.values(this._sl || {}).forEach((s) => s.hold.clear());
      this._config = { ...this._config, entity: id };
    }
    this._v++;
  }
  // A small count badge for a grouped lamp (tile corner / wheel marker).
  _groupBadge(id) {
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
  _colourXY(id) {
    const [h, s] = this._dispHs(id);
    const rad = (h * Math.PI) / 180;
    return {
      x: 50 + (s / 100) * 50 * Math.sin(rad),
      y: 50 - (s / 100) * 50 * Math.cos(rad),
    };
  }
  _warmFrac(id) {
    return clamp((this._dispK(id) - STRIP_LO) / (STRIP_HI - STRIP_LO), 0, 1);
  }
  // Colour temperature is not a hue — it's a warm→white→cool path near the centre.
  // So warm lamps ride a horizontal track across the disc centre: warm (2000 K) at
  // the left, cool (6535 K) at the right; only x carries the value.
  _warmXY(id) {
    return { x: TRACK_X0 + this._warmFrac(id) * TRACK_W, y: 50 };
  }
  // Pointer x → kelvin fraction along the warm track (y is ignored).
  _warmFracAt(clientX, rect) {
    return clamp(
      (clientX - rect.left - (TRACK_X0 / 100) * rect.width) /
        ((TRACK_W / 100) * rect.width),
      0,
      1,
    );
  }

  // Pointer → hue°/sat% (no snap — grouping happens on release, in _wheelUp).
  _colourAt(e, R) {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (r.left + R);
    const dy = e.clientY - (r.top + R);
    let hue = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (hue < 0) hue += 360;
    const sat = clamp((Math.hypot(dx, dy) / R) * 100, 0, 100);
    return [hue, sat];
  }
  _unitXY(u) {
    return u.warm ? this._warmXY(u.rep) : this._colourXY(u.rep);
  }
  // Apply a colour target to a set of lamps: colour lamps take the hs, warm lamps
  // take the nearest colour temperature (so a mixed group tracks the drag).
  _commitColour(members, hue, sat, flush) {
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
  _wheelDown(e) {
    const units = this._units();
    if (!units.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    const distTo = (u) => {
      const p = this._unitXY(u);
      return Math.hypot(
        e.clientX - (r.left + (p.x / 100) * r.width),
        e.clientY - (r.top + (p.y / 100) * r.height),
      );
    };
    let best = null;
    let bestD = Infinity;
    for (const u of units) {
      const d = distTo(u);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    // Prefer the focused lamp's unit when the pointer lands on it.
    const au = units.find((u) => u.members.includes(this._config.entity));
    if (au && distTo(au) <= 22) best = au;
    if (!best) return;
    capturePointer(e.currentTarget, e.pointerId);
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
  _wheelMove(e, final) {
    if (!this._wheel.dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
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
  _wheelUp(e) {
    if (!this._wheel.dragging) return;
    this._wheelMove(e, true);
    const rect = e.currentTarget.getBoundingClientRect();
    // The dragged unit's marker centre (from the live drag state).
    let dp;
    if (this._wheel.kind === "warm") {
      dp = {
        x:
          TRACK_X0 +
          clamp((this._wheel.k - STRIP_LO) / (STRIP_HI - STRIP_LO), 0, 1) *
            TRACK_W,
        y: 50,
      };
    } else {
      const rad = (this._wheel.hue * Math.PI) / 180;
      const s = this._wheel.sat;
      dp = {
        x: 50 + (s / 100) * 50 * Math.sin(rad),
        y: 50 - (s / 100) * 50 * Math.cos(rad),
      };
    }
    const dcx = rect.left + (dp.x / 100) * rect.width;
    const dcy = rect.top + (dp.y / 100) * rect.height;
    const dragged = new Set(this._wheel.members);
    let target = null;
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
        on.forEach((id) => this._setKelvin(id, this._wheel.k, true));
      else this._commitColour(on, this._wheel.hue, this._wheel.sat, true);
    }
    this._v++;
  }
  _dragCancel() {
    this._wheel.dragging = false;
    this._v++;
  }
  // Arrows nudge the active lamp's whole unit — hue/sat for colour, kelvin for warm.
  _wheelKey(e) {
    const id = this._config.entity;
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

  _wheelDisc(hl) {
    const lamps = this._wheelLamps();
    const disabled = !lamps.length;
    const active = this._config.entity;
    let activeText = "";
    if (this._isWarm(active)) {
      activeText = `${Math.round(this._dispK(active) || 0)} K`;
    } else {
      const [ah, as] = this._dispHs(active);
      activeText = `${Math.round(ah)}°, ${Math.round(as)}%`;
    }
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
          this._lAttr(u.rep, "icon") || "solar:lightbulb-bold-duotone";
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
  _lampTiles(hl) {
    const active = this._config.entity;
    return html`<div
      class="lamp-tiles lamp-scroll flex gap-2 overflow-x-auto pb-1"
    >
      ${this._lamps().map((id) => {
        const on = this._lOn(id);
        const unavail = this._lUnavail(id);
        const nm = this._lAttr(id, "friendly_name") || id;
        const isActive = id === active;
        const icon = this._lAttr(id, "icon") || "solar:lightbulb-bold-duotone";
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

  _roomPicker(hl) {
    return html`
      <div class="room-layout grid gap-4">
        <div class="min-w-0">${this._wheelDisc(hl)}</div>
        <div class="grid min-w-0 gap-4">
          ${this._slider(
            "bri",
            `${t(hl, "light_detail.brightness")} · ${this._lAttr(this._config.entity, "friendly_name") || ""}`,
            `${this._pct("bri")}%`,
          )}
          ${this._swatches(hl)} ${this._lampTiles(hl)}
        </div>
      </div>
    `;
  }

  // --- single-light layout ------------------------------------------------------

  _singleControls(hl) {
    const [lo, hi] = this._kRange();
    const curK = Math.round(lo + (this._pct("temp") / 100) * (hi - lo));
    return html`
      ${this._slider("bri", t(hl, "light_detail.brightness"), `${this._pct("bri")}%`)}
      ${
        this._hasColor()
          ? this._wheelDisc(hl)
          : this._hasTemp()
            ? this._slider(
                "temp",
                t(hl, "light_detail.temperature"),
                `${curK} K`,
                {
                  gradient:
                    "linear-gradient(90deg,#ff9838,#ffd9a0,#fff6ea,#e6efff,#bcd2ff)",
                },
              )
            : ""
      }
      ${this._hasTemp() || this._hasColor() ? this._swatches(hl) : ""}
    `;
  }

  /** Header (icon + name + power) then either the room picker or single controls. */
  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const st = this._st();
    const unavail = this._unavail();
    const on = this._on();
    const room = this._room();
    const title = room
      ? cfg.groupName || cfg.title || t(hl, "light_detail.lights")
      : cfg.name || (st && st.attributes.friendly_name) || cfg.entity;
    const icon =
      cfg.icon || (st && st.attributes.icon) || "solar:lightbulb-bold-duotone";
    const lampsOn = this._lamps().filter((id) => this._lOn(id)).length;
    const subtitle = room
      ? t(hl, "light_detail.on_count", {
          on: lampsOn,
          total: this._lamps().length,
        })
      : unavail
        ? t(hl, "light_detail.offline")
        : on
          ? t(hl, "light_detail.on")
          : t(hl, "light_detail.off");

    return html`<div
      class="grid gap-4 rounded-[14px] border border-line bg-card p-[15px]
             ${!room && unavail ? "opacity-60" : ""}"
    >
      <div class="flex items-center gap-3">
        ${
          room
            ? ""
            : html`<div
                class="flex h-9 w-9 flex-none items-center justify-center rounded-xl
                       ${on ? "bg-accentbg text-accent" : "bg-card2 text-muted"}"
              >
                <fib-icon
                  class="h-[20px] w-[20px] [--mdc-icon-size:20px]"
                  icon=${icon}
                ></fib-icon>
              </div>`
        }
        <div class="min-w-0 flex-1">
          <div class="truncate text-[14px] font-semibold text-ink">
            ${title}
          </div>
          <div class="text-[11px] text-muted">${subtitle}</div>
        </div>
        ${
          room
            ? ""
            : pillSwitch({
                on,
                label: t(hl, "light_detail.power"),
                onClick: () => this._toggle(),
              })
        }
      </div>

      ${room ? this._roomPicker(hl) : unavail ? "" : this._singleControls(hl)}
    </div>`;
  }

  /** Masonry height — header + picker + swatches + lamp list. */
  getCardSize() {
    return 5;
  }
  /** Sections view: full width, auto height. */
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: "auto" };
  }
  /** Grid view: auto. */
  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }
}
