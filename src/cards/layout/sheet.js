/* ================================================================== *
 * fibbers-sheet — invisible card; registers {id, title, cards[]} with the sheet
 * layer (body-sheet.js), which opens on hash `#<id>`.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import {
  registerSheet,
  unregisterSheet,
  updateSheetHass,
} from "../../core/body-sheet.js";
import "../../shared/icon.js";

export class FibbersSheet extends LitElement {
  static properties = { preview: { type: Boolean, reflect: true } };
  static styles = [
    css`
      :host {
        display: none;
      }
      :host([preview]) {
        display: block;
      }
    `,
  ];

  static getStubConfig() {
    return {
      type: "custom:fibbers-sheet",
      id: "room",
      title: "Room",
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
    if (
      this._config &&
      this._config.id !== config.id &&
      this.isConnected &&
      !this.preview
    ) {
      unregisterSheet(this._config.id, this);
    }
    this._config = config;
    if (this.isConnected && !this.preview) registerSheet(config.id, this);
  }

  set hass(hass) {
    if (this.preview) return; // card picker: never touch the sheet singleton
    this._hass = hass;
    if (this._config) updateSheetHass(this._config.id, hass);
  }

  connectedCallback() {
    super.connectedCallback();
    // Card picker: HA sets `preview` — don't register with the sheet singleton.
    if (this.preview) return;
    // The sheet is invisible (display:none); collapse the <hui-card> wrapper so it
    // doesn't reserve an empty grid row.
    const cell = this.getRootNode().host;
    if (cell) {
      this._cell = cell;
      cell.style.display = "none";
    }
    if (this._config) registerSheet(this._config.id, this);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._cell) {
      this._cell.style.display = "";
      this._cell = null;
    }
    if (this.preview) return;
    if (this._config) unregisterSheet(this._config.id, this);
  }

  render() {
    if (!this.preview) return html``;
    // This card is invisible in normal use (it just registers a hash-routed
    // sheet), so the picker gets an inert inline mock of what it defines.
    const c = this._config || {};
    return html`<div
      style="display:flex;align-items:center;gap:10px;background:#1d2426;
             border:1px solid #262f31;border-radius:14px;padding:13px"
    >
      <div
        style="display:flex;width:36px;height:36px;align-items:center;
               justify-content:center;border-radius:10px;background:#173524"
      >
        <fib-icon
          style="--mdc-icon-size:19px;color:#74b98a"
          icon=${c.icon || "solar:widget-bold-duotone"}
        ></fib-icon>
      </div>
      <div style="font:600 13px system-ui;color:#e7ecea">
        ${c.title || c.id || "Sheet"}
        <div style="font:500 11px system-ui;color:#8b999c">
          opens on #${c.id || "id"}
        </div>
      </div>
    </div>`;
  }

  getCardSize() {
    return 1;
  }
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
  getGridOptions() {
    return { columns: 1, rows: 1, min_columns: 1, min_rows: 1 };
  }
}
