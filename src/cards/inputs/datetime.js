/* ================================================================== *
 * fibbers-datetime — input_datetime shown big and legible (not an ISO string);
 * handles has_date/has_time. Tap opens more-info to edit (no custom picker).
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t } from "../../shared/i18n.js";
import { twSheet } from "../../shared/tw.js";
import { moreInfo, fmtState, pickEntity } from "../../shared/util.js";
import "../../shared/icon.js";

// Only a real HH:MM prefix, so "unavailable" falls through to "—".
const hhmm = (s) => {
  const m = typeof s === "string" && s.match(/^(\d{2}:\d{2})/);
  return m ? m[1] : "";
};

const EDITOR_SCHEMA = [
  { name: "entity", selector: { entity: {} } },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
];

export class FibbersDateTime extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
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
      type: "custom:fibbers-datetime",
      entity: pickEntity(
        "input_datetime",
        entities,
        entitiesFallback,
        "input_datetime.example",
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
      throw new Error("fibbers-datetime: `entity` is required");
    }
    this._config = config;
  }

  _st() {
    return this.hass && this.hass.states[this._config.entity];
  }
  // time-only → big HH:MM; otherwise HA's localised value (falls back to state).
  _display(st) {
    const a = st.attributes || {};
    if (a.has_time && !a.has_date) return hhmm(st.state) || "—";
    return fmtState(this.hass, st) || st.state || "—";
  }

  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const st = this._st();
    if (!st) {
      return html`<div
        class="rounded-[14px] border border-line bg-card p-[13px] text-[12px] text-muted"
      >
        ${t(hl, "common.not_available")}
      </div>`;
    }
    const name = cfg.name || st.attributes.friendly_name || cfg.entity;
    const icon =
      cfg.icon || st.attributes.icon || "solar:clock-circle-bold-duotone";
    const timeOnly = st.attributes.has_time && !st.attributes.has_date;
    const val = this._display(st);

    return html`<div class="rounded-[14px] border border-line bg-card p-[13px]">
      <div class="mb-1.5 flex items-center gap-2">
        <fib-icon
          class="h-4 w-4 [--mdc-icon-size:16px] text-accent"
          icon=${icon}
        ></fib-icon>
        <span
          class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
          >${name}</span
        >
      </div>
      <button
        type="button"
        class="text-left"
        @click=${() => moreInfo(this, cfg.entity)}
      >
        <span
          class="font-semibold leading-none text-ink ${
            timeOnly ? "text-[30px]" : "text-[20px]"
          }"
          >${val}</span
        >
      </button>
    </div>`;
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
