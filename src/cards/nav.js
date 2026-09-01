/* ================================================================== *
 * fibbers-nav — thin controller for the singleton bar (body-layer.js). No UI of
 * its own; the bar reserves its own bottom space on the view (view-reserve.js).
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { attach, detach, renderBar } from "../body-layer.js";
import { nav } from "../nav-stack.js";

export class FibbersNav extends LitElement {
  static styles = [
    css`
      :host {
        display: block;
      }
    `,
  ];

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
    if (
      config.theme != null &&
      !["none", "fibbers", "fibbers-light", "auto"].includes(config.theme)
    ) {
      throw new Error(
        'fibbers-nav: `theme` must be "fibbers", "fibbers-light", "auto", or "none"',
      );
    }
    if (config.reserve != null && !Number.isFinite(Number(config.reserve))) {
      throw new Error("fibbers-nav: `reserve` must be a number of pixels");
    }
    if (
      config.extra_bottom != null &&
      !Number.isFinite(Number(config.extra_bottom))
    ) {
      throw new Error("fibbers-nav: `extra_bottom` must be a number of pixels");
    }
    this._config = config;
    if (this.isConnected) attach(this, this._config);
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
    return html``;
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
