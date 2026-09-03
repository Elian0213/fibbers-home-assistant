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

/**
 * fibbers-sheet — invisible card that registers {id, title, cards[]} with the
 * sheet layer (core/body-sheet.js), which opens on hash `#<id>`.
 */
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

  /** Minimal room-sheet starter config for the card picker. */
  static getStubConfig() {
    return {
      type: "custom:fibbers-sheet",
      id: "room",
      title: "Room",
      icon: "solar:sofa-2-bold-duotone",
      cards: [],
    };
  }

  /** Validate config; re-register under the new id when it changes on a live card. */
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

  /** Forward hass to the registered sheet so its lazy-built cards stay live. */
  set hass(hass) {
    if (this.preview) return; // card picker: never touch the sheet singleton
    this._hass = hass;
    if (this._config) updateSheetHass(this._config.id, hass);
  }

  /** Collapse the invisible card's <hui-card> wrapper and register with the sheet layer. */
  connectedCallback() {
    super.connectedCallback();
    // Card picker sets `preview` — don't register with the sheet singleton.
    if (this.preview) return;
    // Card is display:none — collapse the <hui-card> wrapper so it doesn't
    // reserve an empty grid row.
    const cell = this.getRootNode().host;
    if (cell) {
      this._cell = cell;
      cell.style.display = "none";
    }
    if (this._config) registerSheet(this._config.id, this);
  }
  /** Restore the collapsed wrapper and unregister from the sheet layer. */
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._cell) {
      this._cell.style.display = "";
      this._cell = null;
    }
    if (this.preview) return;
    if (this._config) unregisterSheet(this._config.id, this);
  }

  /** Nothing in normal use (hash-routed sheet); an inert summary tile in the picker. */
  render() {
    if (!this.preview) return html``;
    // Invisible in normal use (it just registers a hash-routed sheet), so the
    // picker gets an inert inline mock of what it defines.
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

  /** One masonry row — the collapsed wrapper takes no visible space. */
  getCardSize() {
    return 1;
  }
  /** Full-width, single-row footprint in the sections/grid layout. */
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
  /** Pin to a 1×1 minimum so the invisible card never stretches the grid. */
  getGridOptions() {
    return { columns: 1, rows: 1, min_columns: 1, min_rows: 1 };
  }
}
