/* ================================================================== *
 * fibbers-section — the uppercase mono section label.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { twSheet } from "../tw.js";

export class FibbersSection extends LitElement {
  static properties = { _config: { state: true } };
  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  static getStubConfig() {
    return { type: "custom:fibbers-section", label: "Kamers" };
  }

  setConfig(config) {
    if (!config || !config.label) {
      throw new Error("fibbers-section: `label` is required");
    }
    this._config = config;
  }

  set hass(_hass) {}

  render() {
    if (!this._config) return html``;
    return html`<div
      class="px-0.5 pt-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.11em] text-muted"
    >
      ${this._config.label}
    </div>`;
  }

  getCardSize() {
    return 1;
  }
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
}
