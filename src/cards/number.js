/* ================================================================== *
 * fibbers-number — slider/stepper for input_number & number.*
 * drag UI, debounced writes; respects entity min/max/step.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t } from "../i18n.js";
import { twSheet } from "../tw.js";
import { sliderTrack, SliderHold } from "../ui.js";
import {
  fmtNum,
  clamp,
  debounce,
  isUnavail,
  pctFromX,
  pickEntity,
} from "../util.js";
import "../icon.js";

const EDITOR_SCHEMA = [
  { name: "entity", selector: { entity: {} } },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
  { name: "unit", selector: { text: {} } },
  { name: "step", selector: { number: {} } },
  {
    name: "mode",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "slider", label: "Slider" },
          { value: "stepper", label: "Stepper" },
        ],
      },
    },
  },
];

export class FibbersNumber extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _dragging: { state: true },
    _dragVal: { state: true },
  };

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  static getStubConfig(hass, entities, entitiesFallback) {
    return {
      type: "custom:fibbers-number",
      entity: pickEntity(
        "input_number",
        entities,
        entitiesFallback,
        "input_number.example",
      ),
    };
  }

  static getConfigElement() {
    const el = document.createElement("fibbers-form-editor");
    el.schema = EDITOR_SCHEMA;
    return el;
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("fibbers-number: `entity` is required");
    }
    this._config = config;
    this._dragging = false;
    this._dragVal = 0;
    this._debouncedSet = debounce((v) => this._setValue(v), 150);
    this._hold = new SliderHold(this, { tolerance: 0.5 });
  }

  _st() {
    return this.hass && this.hass.states[this._config.entity];
  }
  _unavail() {
    return isUnavail(this._st());
  }
  _bounds() {
    const a = (this._st() && this._st().attributes) || {};
    const min = Number(a.min != null ? a.min : 0);
    const max = Number(a.max != null ? a.max : 100);
    const raw = Number(this._config.step != null ? this._config.step : a.step);
    const step = Number.isFinite(raw) && raw > 0 ? raw : 1;
    return { min, max: max > min ? max : min + 1, step };
  }
  _decimals() {
    const s = this._bounds().step;
    if (Number.isInteger(s)) return 0;
    const i = String(s).indexOf(".");
    return i < 0 ? 0 : String(s).length - i - 1;
  }
  _value() {
    const n = Number(this._st() && this._st().state);
    const entityVal = Number.isFinite(n) ? n : this._bounds().min;
    return this._hold.value(entityVal, {
      dragging: this._dragging,
      dragValue: this._dragVal,
      gone: this._unavail(),
    });
  }
  _snap(v) {
    const { min, max, step } = this._bounds();
    const snapped = Math.round((v - min) / step) * step + min;
    return clamp(Number(snapped.toFixed(4)), min, max);
  }
  _pct(v) {
    const { min, max } = this._bounds();
    return clamp(((v - min) / (max - min)) * 100, 0, 100);
  }
  _valFromX(clientX, track) {
    const { min, max } = this._bounds();
    return this._snap(min + (pctFromX(clientX, track) / 100) * (max - min));
  }

  _setValue(value) {
    if (!this.hass) return;
    this._hold.hold(value); // hold the set value until the entity reports it
    const domain = this._config.entity.split(".")[0]; // input_number | number
    this.hass.callService(domain, "set_value", {
      entity_id: this._config.entity,
      value,
    });
  }

  _down(e) {
    if (this._unavail()) return;
    const el = e.currentTarget;
    this._dragging = true;
    el.setPointerCapture && el.setPointerCapture(e.pointerId);
    this._dragVal = this._valFromX(e.clientX, el);
    this._debouncedSet(this._dragVal);
  }
  _move(e) {
    if (!this._dragging) return;
    this._dragVal = this._valFromX(e.clientX, e.currentTarget);
    this._debouncedSet(this._dragVal);
  }
  _up(e) {
    if (!this._dragging) return;
    const v = this._valFromX(e.clientX, e.currentTarget);
    this._dragging = false;
    this._debouncedSet.cancel();
    this._setValue(v); // final value wins immediately
  }
  _bump(dir) {
    if (this._unavail()) return;
    this._setValue(this._snap(this._value() + dir * this._bounds().step));
  }

  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const st = this._st();
    const unavail = this._unavail();
    const name = cfg.name || (st && st.attributes.friendly_name) || cfg.entity;
    const icon =
      cfg.icon || (st && st.attributes.icon) || "solar:tuning-2-bold-duotone";
    const unit =
      cfg.unit != null
        ? cfg.unit
        : (st && st.attributes.unit_of_measurement) || "";
    const v = this._value();
    const val = unavail
      ? t(hl, "number.unavailable")
      : `${fmtNum(this.hass, v, this._decimals())}${unit ? ` ${unit}` : ""}`;
    const pct = this._pct(v);

    const head = html`<div class="flex items-center gap-2.5">
      <div
        class="flex h-7 w-7 flex-none items-center justify-center rounded-lg
               ${unavail ? "bg-card2 text-muted" : "bg-accentbg text-accent"}"
      >
        <fib-icon
          class="h-[17px] w-[17px] [--mdc-icon-size:17px]"
          icon=${icon}
        ></fib-icon>
      </div>
      <span class="flex-1 text-[12px] font-medium text-ink">${name}</span>
      <span class="whitespace-nowrap text-[11px] font-medium text-muted"
        >${val}</span
      >
    </div>`;

    if (cfg.mode === "stepper") {
      return html`<div
        class="flex items-center gap-2.5 rounded-[14px] border border-line bg-card p-[13px]
               ${unavail ? "opacity-50" : ""}"
      >
        <div
          class="flex h-7 w-7 flex-none items-center justify-center rounded-lg
                 ${unavail ? "bg-card2 text-muted" : "bg-accentbg text-accent"}"
        >
          <fib-icon
            class="h-[17px] w-[17px] [--mdc-icon-size:17px]"
            icon=${icon}
          ></fib-icon>
        </div>
        <span class="flex-1 text-[12px] font-medium text-ink">${name}</span>
        ${this._stepBtn("solar:minus-circle-bold-duotone", -1, unavail)}
        <span
          class="min-w-[52px] text-center text-[13px] font-semibold text-ink"
          >${val}</span
        >
        ${this._stepBtn("solar:add-circle-bold-duotone", 1, unavail)}
      </div>`;
    }

    return html`<div
      class="rounded-[14px] border border-line bg-card p-[13px] ${
        unavail ? "opacity-50" : ""
      }"
    >
      ${head}
      ${(() => {
        const b = this._bounds();
        return sliderTrack({
          pct,
          disabled: unavail,
          cls: "mt-2.5",
          label: name,
          value: v,
          min: b.min,
          max: b.max,
          step: b.step,
          valueText: val,
          onInput: (nv) => this._setValue(this._snap(nv)),
          onDown: this._down,
          onMove: this._move,
          onUp: this._up,
          onCancel: () => {
            this._dragging = false;
          },
        });
      })()}
    </div>`;
  }

  _stepBtn(icon, dir, unavail) {
    const hl = this._config.language || this.hass;
    return html`<button
      type="button"
      class="fib-hit flex h-8 w-8 flex-none items-center justify-center rounded-full bg-card2
             text-accent transition-transform active:scale-90
             ${unavail ? "pointer-events-none opacity-40" : ""}"
      aria-label=${dir > 0 ? t(hl, "number.more") : t(hl, "number.less")}
      @click=${() => this._bump(dir)}
    >
      <fib-icon
        class="h-[22px] w-[22px] [--mdc-icon-size:22px]"
        icon=${icon}
      ></fib-icon>
    </button>`;
  }

  getCardSize() {
    return 1;
  }
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }
}
