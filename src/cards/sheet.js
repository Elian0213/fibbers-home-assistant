/* ================================================================== *
 * fibbers-sheet — invisible card; registers {id, title, cards[]} with the sheet
 * layer (body-sheet.js), which opens on hash `#<id>`.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import {
  registerSheet,
  unregisterSheet,
  updateSheetHass,
} from "../body-sheet.js";

export class FibbersSheet extends LitElement {
  static styles = [
    css`
      :host {
        display: none;
      }
    `,
  ];

  static getStubConfig() {
    return {
      type: "custom:fibbers-sheet",
      id: "woonkamer",
      title: "Woonkamer",
      icon: "solar:sofa-2-bold-duotone",
      cards: [],
    };
  }

  setConfig(config) {
    if (!config || !config.id || typeof config.id !== "string") {
      throw new Error("fibbers-sheet: `id` (a unique string) is required");
    }
    if (config.cards != null && !Array.isArray(config.cards)) {
      throw new Error("fibbers-sheet: `cards` must be a list");
    }
    if (this._config && this._config.id !== config.id && this.isConnected) {
      unregisterSheet(this._config.id, this);
    }
    this._config = config;
    if (this.isConnected) registerSheet(config.id, this);
  }

  set hass(hass) {
    this._hass = hass;
    if (this._config) updateSheetHass(this._config.id, hass);
  }

  connectedCallback() {
    super.connectedCallback();
    if (this._config) registerSheet(this._config.id, this);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._config) unregisterSheet(this._config.id, this);
  }

  render() {
    return html``;
  }

  getCardSize() {
    return 1;
  }
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
}
