/* ================================================================== *
 * fibbers-toggle — switch row for input_boolean/switch/automation (shared pill).
 * Optional `secondary`/`secondary_entity` subline and `confirm` guard.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { twSheet } from "../tw.js";
import { pillSwitch } from "../ui.js";
import { fmtState } from "../util.js";
import "../icon.js";

export class FibbersToggle extends LitElement {
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

  static getStubConfig() {
    return {
      type: "custom:fibbers-toggle",
      entity: "input_boolean.wake_alarm_enabled",
    };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("fibbers-toggle: `entity` is required");
    }
    this._config = config;
  }

  _st() {
    return this.hass && this.hass.states[this._config.entity];
  }
  _toggle() {
    if (!this.hass) return;
    const cfg = this._config;
    if (cfg.confirm && !window.confirm(`${cfg.name || cfg.entity}?`)) return;
    this.hass.callService("homeassistant", "toggle", { entity_id: cfg.entity });
  }
  _secondary() {
    const cfg = this._config;
    if (cfg.secondary) return cfg.secondary;
    if (cfg.secondary_entity) {
      const s = this.hass && this.hass.states[cfg.secondary_entity];
      return s ? fmtState(this.hass, s) : "";
    }
    return "";
  }

  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const st = this._st();
    if (!st) {
      return html`<div
        class="rounded-[14px] border border-line bg-card p-[13px] text-[12px] text-muted"
      >
        Niet beschikbaar
      </div>`;
    }
    const on = st.state === "on";
    const name = cfg.name || st.attributes.friendly_name || cfg.entity;
    const icon = cfg.icon || st.attributes.icon || "solar:power-bold-duotone";
    const sub = this._secondary();

    return html`<div
      class="flex items-center gap-2.5 rounded-[14px] border border-line bg-card p-[13px]"
    >
      <div
        class="flex h-8 w-8 flex-none items-center justify-center rounded-lg
               ${on ? "bg-accentbg text-accent" : "bg-card2 text-muted"}"
      >
        <fib-icon
          class="h-[18px] w-[18px] [--mdc-icon-size:18px]"
          icon=${icon}
        ></fib-icon>
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-[12px] font-medium text-ink">${name}</div>
        ${
          sub
            ? html`<div class="truncate text-[10.5px] text-muted">${sub}</div>`
            : ""
        }
      </div>
      ${pillSwitch({ on, onClick: () => this._toggle(), label: name })}
    </div>`;
  }

  getCardSize() {
    return 1;
  }
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
}
