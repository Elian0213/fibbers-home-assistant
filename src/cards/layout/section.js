/* ================================================================== *
 * fibbers-section — the uppercase mono section label.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { twSheet } from "../../shared/tw.js";

const EDITOR_SCHEMA = [{ name: "label", selector: { text: {} } }];

/** fibbers-section — uppercase mono divider label between stacks of cards. */
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

  /** Starter config for the card picker. */
  static getStubConfig() {
    return { type: "custom:fibbers-section", label: "Section" };
  }

  /** Return the shared form editor, wired to this card's schema. */
  static getConfigElement() {
    const el = document.createElement("fibbers-form-editor");
    el.schema = EDITOR_SCHEMA;
    return el;
  }

  /** Require a `label` and store the config. */
  setConfig(config) {
    if (!config || !config.label) {
      throw new Error("fibbers-section: `label` is required");
    }
    this._config = config;
  }

  /** No-op — a static label needs no state. */
  set hass(_hass) {}

  /** The uppercase mono label. */
  render() {
    if (!this._config) return html``;
    return html`<div
      class="px-0.5 pt-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.11em] text-muted"
    >
      ${this._config.label}
    </div>`;
  }

  /** One masonry row. */
  getCardSize() {
    return 1;
  }
  /** Full-width, single-row footprint in the sections/grid layout. */
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
  /** Span the full grid width; height follows content. */
  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }
}
