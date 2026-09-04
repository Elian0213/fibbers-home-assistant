/* ================================================================== *
 * fibbers-light-detail — the full single-light control (brightness, colour
 * temperature, hue/saturation, quick swatches) as one Fibbers card, so the
 * more-info modal isn't a brightness-only downgrade. Reuses the shared slider
 * primitives (sliderTrack + sliderDrag + SliderHold); each control is one
 * per-attribute drag controller with live-track + snap-back hold.
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

/**
 * fibbers-light-detail — a full single-light control (brightness + colour
 * temperature + hue/saturation + swatches), used by the more-info modal and
 * standalone.
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

  /** Validate + build the per-attribute slider controllers (once, reused). */
  setConfig(config) {
    if (!config || !config.entity || !config.entity.startsWith("light.")) {
      throw new Error("fibbers-light-detail: `entity` must be a light.*");
    }
    this._config = config;
    this._v = 0;
    // One controller per control. `commit(pct)` maps 0-100 → the attribute's own
    // service call; `hold`/`drag` are the shared live-track + snap-back pipeline.
    this._sl = this._sl || {};
    this._mk("bri", (pct) => this._call({ brightness_pct: Math.round(pct) }));
    this._mk("temp", (pct) => {
      const [lo, hi] = this._kRange();
      this._call({
        color_temp_kelvin: Math.round(lo + (pct / 100) * (hi - lo)),
      });
    });
    this._mk("hue", (pct) =>
      this._call({ hs_color: [Math.round((pct / 100) * 360), this._hs()[1]] }),
    );
    this._mk("sat", (pct) =>
      this._call({ hs_color: [this._hs()[0], Math.round(pct)] }),
    );
  }

  _mk(key, commit) {
    if (this._sl[key]) {
      this._sl[key].hold.clear();
      return;
    }
    const s = { dragging: false, dragPct: 0 };
    s.hold = new SliderHold(this, { tolerance: 2, timeout: 2500 });
    // Arm the hold on every commit so the control shows the committed value until the
    // light reports it. Without this the drag-release path never held (unlike the
    // light-row committer) and the colour/brightness sliders snapped back to the
    // stale entity value for the whole service round-trip.
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
  }

  _st() {
    return this.hass && this.hass.states[this._config.entity];
  }
  _unavail() {
    return isUnavail(this._st());
  }
  _on() {
    const st = this._st();
    return !!st && st.state === "on";
  }
  _attr(k) {
    const st = this._st();
    return st && st.attributes ? st.attributes[k] : undefined;
  }
  _modes() {
    return this._attr("supported_color_modes") || [];
  }
  _hasTemp() {
    return this._modes().includes("color_temp");
  }
  _hasColor() {
    return this._modes().some((m) => COLOR_MODES.includes(m));
  }
  // Kelvin range: prefer the entity's own, else a sensible default.
  _kRange() {
    const lo = Number(this._attr("min_color_temp_kelvin")) || 2000;
    const hi = Number(this._attr("max_color_temp_kelvin")) || 6535;
    return [lo, hi > lo ? hi : lo + 1];
  }
  _hs() {
    const hs = this._attr("hs_color");
    return Array.isArray(hs) ? hs : [0, 0];
  }

  // Display % for each control, with the snap-back hold applied.
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
    } else if (key === "hue") raw = clamp((this._hs()[0] / 360) * 100, 0, 100);
    else if (key === "sat") raw = clamp(this._hs()[1], 0, 100);
    return Math.round(
      s.hold.value(raw, {
        dragging: s.dragging,
        dragValue: s.dragPct,
        gone: this._unavail() || !this._on(),
      }),
    );
  }

  _call(data) {
    if (!this.hass) return;
    const entity_id = this._config.entity;
    // hold the driven control so it doesn't snap back before the light reports
    Promise.resolve(
      this.hass.callService("light", "turn_on", { entity_id, ...data }),
    ).catch(() => {});
  }
  _toggle() {
    if (!this.hass || this._unavail()) return;
    this.hass.callService("light", "toggle", {
      entity_id: this._config.entity,
    });
  }

  // Sibling lamps to switch between (room/group context), live entities only.
  _siblings() {
    const ids = this._config.siblings;
    return Array.isArray(ids)
      ? ids.filter((id) => this.hass && this.hass.states[id])
      : [];
  }

  // Switch the controlled lamp in place — clear the per-attribute holds so the new
  // lamp's values don't inherit the previous one's optimistic display.
  _switchTo(id) {
    if (!id || id === this._config.entity) return;
    Object.values(this._sl || {}).forEach((s) => s.hold.clear());
    this._config = { ...this._config, entity: id };
    this._v++;
  }

  // Roving focus for the lamp switcher tablist; Left/Right/Home/End, activate on move.
  _switcherKey(e) {
    const ids = this._siblings();
    if (!ids.length) return;
    const cur = ids.indexOf(this._config.entity);
    const delta = { ArrowLeft: -1, ArrowRight: 1 };
    let next;
    if (e.key in delta) next = (cur + delta[e.key] + ids.length) % ids.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = ids.length - 1;
    else return;
    e.preventDefault();
    this._switchTo(ids[next]);
    this.updateComplete.then(() => {
      const tab = this.renderRoot.querySelector(
        '[role="tab"][aria-selected="true"]',
      );
      if (tab) tab.focus();
    });
  }

  // A horizontal tablist of the room/group's lamps (only when there's more than one).
  _switcher(hl) {
    const ids = this._siblings();
    if (ids.length <= 1) return "";
    return html`<div
      role="tablist"
      aria-label=${t(hl, "light_detail.lights")}
      class="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5"
      @keydown=${this._switcherKey}
    >
      ${ids.map((id) => {
        const sel = id === this._config.entity;
        const st = this.hass && this.hass.states[id];
        const on = !!st && st.state === "on";
        const nm = (st && st.attributes.friendly_name) || id;
        return html`<button
          type="button"
          role="tab"
          aria-selected=${sel ? "true" : "false"}
          tabindex=${sel ? 0 : -1}
          class="fib-hit flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full
                 border px-3 py-1 text-[11px] font-medium transition-colors
                 ${
                   sel
                     ? "border-accent bg-accentbg text-accent"
                     : "border-line bg-card2 text-ink2"
                 }"
          @click=${() => this._switchTo(id)}
        >
          <span
            class="h-1.5 w-1.5 flex-none rounded-full ${on ? "bg-accent" : "bg-muted"}"
          ></span>
          ${nm}
        </button>`;
      })}
    </div>`;
  }

  // One slider row: label + value on top, the track below.
  _slider(key, label, valueText, opts = {}) {
    const s = this._sl[key];
    const pct = this._pct(key);
    const disabled = this._unavail() || (opts.needsOn && !this._on());
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
    return html`<div class="flex flex-wrap gap-2">
      ${
        this._hasTemp()
          ? WHITES.map((w) =>
              btn(w.css, `${t(hl, "light_detail." + w.key)} (${w.k}K)`, () =>
                this._call({ color_temp_kelvin: w.k }),
              ),
            )
          : ""
      }
      ${
        this._hasColor()
          ? HUES.map((h) =>
              btn(
                `hsl(${h} 90% 55%)`,
                `${t(hl, "light_detail.colour")} ${h}°`,
                () => this._call({ hs_color: [h, 90] }),
              ),
            )
          : ""
      }
    </div>`;
  }

  /** Header (icon + name + power) then brightness, temperature, colour, swatches. */
  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const st = this._st();
    const unavail = this._unavail();
    const on = this._on();
    const name = cfg.name || (st && st.attributes.friendly_name) || cfg.entity;
    const icon =
      cfg.icon || (st && st.attributes.icon) || "solar:lightbulb-bold-duotone";

    const [lo, hi] = this._kRange();
    const curK = Math.round(lo + (this._pct("temp") / 100) * (hi - lo));

    return html`<div
      class="grid gap-4 rounded-[14px] border border-line bg-card p-[15px]
             ${unavail ? "opacity-60" : ""}"
    >
      ${this._switcher(hl)}
      <div class="flex items-center gap-3">
        <div
          class="flex h-9 w-9 flex-none items-center justify-center rounded-xl
                 ${on ? "bg-accentbg text-accent" : "bg-card2 text-muted"}"
        >
          <fib-icon
            class="h-[20px] w-[20px] [--mdc-icon-size:20px]"
            icon=${icon}
          ></fib-icon>
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-[14px] font-semibold text-ink">${name}</div>
          <div class="text-[11px] text-muted">
            ${
              unavail
                ? t(hl, "light_detail.offline")
                : on
                  ? t(hl, "light_detail.on")
                  : t(hl, "light_detail.off")
            }
          </div>
        </div>
        ${pillSwitch({
          on,
          label: t(hl, "light_detail.power"),
          onClick: () => this._toggle(),
        })}
      </div>

      ${
        unavail
          ? ""
          : html`
              ${this._slider(
                "bri",
                t(hl, "light_detail.brightness"),
                `${this._pct("bri")}%`,
                {
                  needsOn: true,
                },
              )}
              ${
                this._hasTemp()
                  ? this._slider(
                      "temp",
                      t(hl, "light_detail.temperature"),
                      `${curK} K`,
                      {
                        needsOn: true,
                        gradient:
                          "linear-gradient(90deg,#ff9838,#ffd9a0,#fff6ea,#e6efff,#bcd2ff)",
                      },
                    )
                  : ""
              }
              ${
                this._hasColor()
                  ? html`
                      ${this._slider(
                        "hue",
                        t(hl, "light_detail.hue"),
                        `${Math.round((this._pct("hue") / 100) * 360)}°`,
                        {
                          needsOn: true,
                          gradient:
                            "linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)",
                        },
                      )}
                      ${this._slider(
                        "sat",
                        t(hl, "light_detail.saturation"),
                        `${this._pct("sat")}%`,
                        {
                          needsOn: true,
                          gradient: `linear-gradient(90deg,#8a9599,hsl(${Math.round((this._pct("hue") / 100) * 360)} 90% 55%))`,
                        },
                      )}
                    `
                  : ""
              }
              ${this._hasTemp() || this._hasColor() ? this._swatches(hl) : ""}
            `
      }
    </div>`;
  }

  /** Masonry height — header + up to four sliders + swatches. */
  getCardSize() {
    return 4;
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
