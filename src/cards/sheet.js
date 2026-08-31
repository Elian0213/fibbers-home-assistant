/* ================================================================== *
 * CARD — fibbers-sheet
 *
 * A hash-routed modal. The card itself is invisible in the view; it registers
 * its {id, title, cards[]} with the singleton sheet layer, which opens when the
 * URL hash matches `#<id>`. Open one with a link/tap to `#<id>` (e.g. a
 * fibbers-room's `sheet:` config).
 * ================================================================== */
import {
  registerSheet,
  unregisterSheet,
  updateSheetHass,
} from "../body-sheet.js";

export class FibbersSheet extends HTMLElement {
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
    // if the id changed, drop the old registration
    if (this._config && this._config.id !== config.id && this.isConnected) {
      unregisterSheet(this._config.id, this);
    }
    this._config = config;
    if (!this._marker) {
      // invisible controller — takes no visual space
      this._marker = document.createElement("span");
      this._marker.style.display = "none";
      this.appendChild(this._marker);
    }
    if (this.isConnected) registerSheet(config.id, this);
  }

  set hass(hass) {
    this._hass = hass;
    if (this._config) updateSheetHass(this._config.id, hass);
  }

  connectedCallback() {
    if (this._config) registerSheet(this._config.id, this);
  }

  disconnectedCallback() {
    if (this._config) unregisterSheet(this._config.id, this);
  }

  getCardSize() {
    return 1;
  }

  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
}
