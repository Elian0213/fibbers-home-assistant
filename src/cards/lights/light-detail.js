/* ================================================================== *
 * fibbers-light-detail — the full light control used by the more-info modal.
 * Single light: brightness, a warm→cool temperature slider, a colour wheel and
 * quick swatches. Opened from a room/group (siblings): a Philips-Hue-style room
 * picker — a Colour wheel / Warm strip carrying one draggable dot per lamp (drag
 * a dot onto another to snap them to the same colour), with the lamps listed
 * below for per-lamp brightness and on/off. Reuses the shared slider primitives.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t } from "../../shared/i18n.js";
import { twSheet } from "../../shared/tw.js";
import {
  sliderTrack,
  sliderDrag,
  pillSwitch,
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
// A fixed display range for the Warm strip so every lamp's dot sits on one scale.
const STRIP_LO = 2000;
const STRIP_HI = 6535;
// Drag snap distance (px) between two colour dots before they merge to one colour.
const SNAP_PX = 18;

/**
 * fibbers-light-detail — a full light control (brightness, temperature, a colour
 * wheel, swatches) and, when opened for a room/group, a multi-lamp room picker.
 */
export class FibbersLightDetail extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _tab: { state: true }, // "colour" | "warm" (room picker)
    _v: { state: true }, // bump to force re-render on drag frames
  };

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
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
    if (this._tab == null) this._tab = "colour";
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
    // The colour wheel / warm strip drive one lamp at a time; a per-lamp display
    // hold keeps each dragged dot on its committed spot until the lamp reports.
    this._wheel = this._wheel || { mode: null, lampId: null, dragging: false };
    this._cHold = this._cHold || new Map(); // id → { h, s, exp }
    this._kHold = this._kHold || new Map(); // id → { k, exp }
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
    return this._lamps().filter((id) => this._lOn(id) && this._lHasColor(id));
  }
  _warmLamps() {
    return this._lamps().filter((id) => this._lOn(id) && this._lHasTemp(id));
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
      this._wheel.lampId === id &&
      this._wheel.mode === "colour"
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
      this._wheel.lampId === id &&
      this._wheel.mode === "warm"
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
    return html`<div class="flex flex-wrap gap-2">
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

  // --- colour wheel (hue = angle clockwise from top, saturation = radius) --------

  // Dot centre for a lamp's hue/sat, in 0-100% of the disc.
  _colourXY(id) {
    const [h, s] = this._dispHs(id);
    const rad = (h * Math.PI) / 180;
    return {
      x: 50 + (s / 100) * 50 * Math.sin(rad),
      y: 50 - (s / 100) * 50 * Math.cos(rad),
    };
  }
  // Pointer → hue°/sat%, snapping onto another lamp's dot within SNAP_PX.
  _colourAt(e, R) {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (r.left + R);
    const dy = e.clientY - (r.top + R);
    let hue = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (hue < 0) hue += 360;
    let sat = clamp((Math.hypot(dx, dy) / R) * 100, 0, 100);
    const mx = (sat / 100) * R * Math.sin((hue * Math.PI) / 180);
    const my = -(sat / 100) * R * Math.cos((hue * Math.PI) / 180);
    for (const other of this._colourLamps()) {
      if (other === this._wheel.lampId) continue;
      const [oh, os] = this._dispHs(other);
      const ox = (os / 100) * R * Math.sin((oh * Math.PI) / 180);
      const oy = -(os / 100) * R * Math.cos((oh * Math.PI) / 180);
      if (Math.hypot(mx - ox, my - oy) <= SNAP_PX) {
        hue = oh;
        sat = os;
        break;
      }
    }
    return [hue, sat];
  }
  _colourDown(e) {
    const lamps = this._colourLamps();
    if (!lamps.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    // Grab the nearest lamp dot to the pointer.
    let best = null;
    let bestD = Infinity;
    for (const id of lamps) {
      const p = this._colourXY(id);
      const d = Math.hypot(
        e.clientX - (r.left + (p.x / 100) * r.width),
        e.clientY - (r.top + (p.y / 100) * r.height),
      );
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    capturePointer(e.currentTarget, e.pointerId);
    this._wheel = {
      mode: "colour",
      lampId: best,
      dragging: true,
      hue: 0,
      sat: 0,
    };
    this._selectActive(best);
    this._colourMove(e);
  }
  _colourMove(e, final) {
    if (!this._wheel.dragging || this._wheel.mode !== "colour") return;
    const R = e.currentTarget.getBoundingClientRect().width / 2;
    if (R <= 0) return;
    const [hue, sat] = this._colourAt(e, R);
    this._wheel.hue = hue;
    this._wheel.sat = sat;
    this._v++;
    this._setColour(this._wheel.lampId, hue, sat, final);
  }
  _colourUp(e) {
    if (!this._wheel.dragging || this._wheel.mode !== "colour") return;
    this._colourMove(e, true);
    this._wheel.dragging = false;
    this._v++;
  }
  _dragCancel() {
    this._wheel.dragging = false;
    this._v++;
  }
  // Arrows nudge the active lamp's hue (Left/Right) and saturation (Up/Down).
  _colourKey(e) {
    const id = this._config.entity;
    if (!this._lOn(id) || !this._lHasColor(id)) return;
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
    this._setColour(id, hue, sat, true);
    this._v++;
  }

  _colourWheel(hl) {
    const lamps = this._colourLamps();
    const disabled = !lamps.length;
    const active = this._config.entity;
    const [ah, as] = this._dispHs(active);
    return html`<div
      class="relative mx-auto aspect-square w-full max-w-[240px] touch-none select-none
             rounded-full ${disabled ? "opacity-40" : "cursor-pointer"}"
      style="background:radial-gradient(circle at center,#fff 0%,rgba(255,255,255,0) 100%),
             conic-gradient(from 0deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)"
      role="slider"
      tabindex=${disabled ? -1 : 0}
      aria-label=${t(hl, "light_detail.colour")}
      aria-valuetext=${`${Math.round(ah)}°, ${Math.round(as)}%`}
      aria-disabled=${disabled ? "true" : "false"}
      @pointerdown=${this._colourDown}
      @pointermove=${this._colourMove}
      @pointerup=${this._colourUp}
      @pointercancel=${this._dragCancel}
      @lostpointercapture=${this._dragCancel}
      @keydown=${this._colourKey}
    >
      ${lamps.map((id) => {
        const p = this._colourXY(id);
        const [h] = this._dispHs(id);
        const isActive = id === active;
        return html`<div
          class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full
                 border-2 border-white shadow-[0_1px_5px_rgba(0,0,0,.6)]
                 ${isActive ? "h-6 w-6 ring-2 ring-white/60" : "h-[18px] w-[18px]"}"
          style="left:${p.x}%;top:${p.y}%;background:hsl(${Math.round(h)} 90% 50%)"
        ></div>`;
      })}
    </div>`;
  }

  // --- warm strip (kelvin along x) ----------------------------------------------

  _warmFrac(id) {
    return clamp((this._dispK(id) - STRIP_LO) / (STRIP_HI - STRIP_LO), 0, 1);
  }
  _warmDown(e) {
    const lamps = this._warmLamps();
    if (!lamps.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    let best = null;
    let bestD = Infinity;
    for (const id of lamps) {
      const d = Math.abs(e.clientX - (r.left + this._warmFrac(id) * r.width));
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    capturePointer(e.currentTarget, e.pointerId);
    this._wheel = {
      mode: "warm",
      lampId: best,
      dragging: true,
      k: this._dispK(best),
    };
    this._selectActive(best);
    this._warmMove(e);
  }
  _warmMove(e, final) {
    if (!this._wheel.dragging || this._wheel.mode !== "warm") return;
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width <= 0) return;
    const frac = clamp((e.clientX - r.left) / r.width, 0, 1);
    const k = Math.round(STRIP_LO + frac * (STRIP_HI - STRIP_LO));
    this._wheel.k = k;
    this._v++;
    this._setKelvin(this._wheel.lampId, k, final);
  }
  _warmUp(e) {
    if (!this._wheel.dragging || this._wheel.mode !== "warm") return;
    this._warmMove(e, true);
    this._wheel.dragging = false;
    this._v++;
  }

  _warmStripEl(hl) {
    const lamps = this._warmLamps();
    const disabled = !lamps.length;
    return html`<div
      class="relative h-[var(--fib-hit)] w-full touch-none select-none
             ${disabled ? "opacity-40" : "cursor-pointer"}"
      role="group"
      aria-label=${t(hl, "light_detail.temperature")}
      @pointerdown=${this._warmDown}
      @pointermove=${this._warmMove}
      @pointerup=${this._warmUp}
      @pointercancel=${this._dragCancel}
      @lostpointercapture=${this._dragCancel}
    >
      <div
        class="pointer-events-none absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full"
        style="background:linear-gradient(90deg,#ff9838,#ffd9a0,#fff6ea,#e6efff,#bcd2ff)"
      ></div>
      ${lamps.map((id) => {
        const isActive = id === this._config.entity;
        return html`<div
          class="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full
                 border-2 border-white bg-white shadow-[0_1px_5px_rgba(0,0,0,.6)]
                 ${isActive ? "h-6 w-6 ring-2 ring-white/60" : "h-[18px] w-[18px]"}"
          style="left:${this._warmFrac(id) * 100}%"
        ></div>`;
      })}
    </div>`;
  }

  // --- room picker (tabs + picker + swatches + lamp list) -----------------------

  _tabs(hl) {
    const tab = (key, label) =>
      html`<button
        type="button"
        role="tab"
        aria-selected=${this._tab === key ? "true" : "false"}
        class="fib-hit flex-1 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors
             ${this._tab === key ? "bg-accent text-[#0c1510]" : "text-ink2"}"
        @click=${() => {
          this._tab = key;
        }}
      >
        ${label}
      </button>`;
    return html`<div
      role="tablist"
      class="flex gap-1 rounded-full border border-line bg-card2 p-1"
      aria-label=${t(hl, "light_detail.colour")}
    >
      ${tab("colour", t(hl, "light_detail.colour"))}
      ${tab("warm", t(hl, "light_detail.white"))}
    </div>`;
  }

  _lampList(hl) {
    const active = this._config.entity;
    return html`<div class="grid gap-0.5">
      ${this._lamps().map((id) => {
        const on = this._lOn(id);
        const unavail = this._lUnavail(id);
        const nm = this._lAttr(id, "friendly_name") || id;
        const isActive = id === active;
        let dot = "#3a4446";
        if (on && this._lHasColor(id)) {
          const [h, s] = this._dispHs(id);
          dot = `hsl(${Math.round(h)} ${Math.round(clamp(s, 15, 90))}% 55%)`;
        } else if (on) dot = "#ffd9a0";
        return html`<div
          class="flex items-center gap-2 rounded-lg px-2 py-1.5
                 ${isActive ? "bg-card2" : ""} ${unavail ? "opacity-50" : ""}"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-pressed=${isActive ? "true" : "false"}
            @click=${() => this._selectActive(id)}
          >
            <span
              class="h-2.5 w-2.5 flex-none rounded-full"
              style="background:${dot}"
            ></span>
            <span
              class="truncate text-[12px] ${isActive ? "font-medium text-ink" : "text-ink2"}"
              >${nm}</span
            >
          </button>
          ${
            unavail
              ? html`<span class="text-[10.5px] text-muted"
                  >${t(hl, "light_detail.offline")}</span
                >`
              : pillSwitch({ on, label: nm, onClick: () => this._toggle(id) })
          }
        </div>`;
      })}
    </div>`;
  }

  _roomPicker(hl) {
    return html`
      ${this._tabs(hl)}
      ${this._tab === "warm" ? this._warmStripEl(hl) : this._colourWheel(hl)}
      ${this._slider(
        "bri",
        `${t(hl, "light_detail.brightness")} · ${this._lAttr(this._config.entity, "friendly_name") || ""}`,
        `${this._pct("bri")}%`,
      )}
      ${this._swatches(hl)} ${this._lampList(hl)}
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
          ? this._colourWheel(hl)
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
        <div
          class="flex h-9 w-9 flex-none items-center justify-center rounded-xl
                 ${on || room ? "bg-accentbg text-accent" : "bg-card2 text-muted"}"
        >
          <fib-icon
            class="h-[20px] w-[20px] [--mdc-icon-size:20px]"
            icon=${room ? "solar:lightbulb-bolt-bold-duotone" : icon}
          ></fib-icon>
        </div>
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
