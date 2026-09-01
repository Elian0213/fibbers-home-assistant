/* ================================================================== *
 * fibbers-nav — thin controller for the singleton bar (body-layer.js); reserves
 * a spacer of the bar's height. No UI of its own.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { bar, attach, detach, renderBar } from "../body-layer.js";
import { nav } from "../nav-stack.js";

export class FibbersNav extends LitElement {
  static properties = { _spacerH: { state: true } };
  static styles = [
    css`
      :host {
        display: block;
      }
    `,
  ];

  constructor() {
    super();
    this._spacerH = 0;
  }

  static getStubConfig() {
    return {
      type: "custom:fibbers-nav",
      tabs: [
        {
          name: "Huis",
          icon: "solar:home-2-bold-duotone",
          path: "/dashboard-thuis/huis",
        },
        {
          name: "Licht",
          icon: "solar:lightbulb-bolt-bold-duotone",
          path: "/dashboard-thuis/licht",
        },
      ],
    };
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.tabs) || !config.tabs.length) {
      throw new Error(
        "fibbers-nav: `tabs` must be a non-empty list of {name, icon, path}",
      );
    }
    config.tabs.forEach((t, i) => {
      if (!t || !t.path)
        throw new Error(`fibbers-nav: tabs[${i}] is missing \`path\``);
    });
    if (
      config.offset_bottom != null &&
      !Number.isFinite(Number(config.offset_bottom))
    ) {
      throw new Error(
        "fibbers-nav: `offset_bottom` must be a number of pixels",
      );
    }
    if (
      config.hide_ha_tabs != null &&
      config.hide_ha_tabs !== true &&
      config.hide_ha_tabs !== false &&
      config.hide_ha_tabs !== "header"
    ) {
      throw new Error(
        'fibbers-nav: `hide_ha_tabs` must be false, true, or "header"',
      );
    }
    if (
      config.respect_sidebar != null &&
      typeof config.respect_sidebar !== "boolean"
    ) {
      throw new Error("fibbers-nav: `respect_sidebar` must be true or false");
    }
    this._config = config;
    this._syncSpacer();
    if (this.isConnected) attach(this, this._config);
  }

  /** called by body-layer when the bar height changes */
  _syncSpacer() {
    const cfg = this._config || {};
    const offset = Number(cfg.offset_bottom) || 0;
    const base = cfg.reserve != null ? cfg.reserve : bar.height || 74;
    this._spacerH = Math.round(base + offset);
  }

  set hass(hass) {
    nav.hassRef = hass;
    if (this._config && (this._config.tabs || []).some((t) => t.badge))
      renderBar();
  }

  connectedCallback() {
    super.connectedCallback();
    if (this._config) attach(this, this._config);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    detach(this);
  }

  render() {
    return html`<div style="height:${this._spacerH || 0}px"></div>`;
  }

  getCardSize() {
    return 1;
  }
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
}
