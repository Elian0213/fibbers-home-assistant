/* ================================================================== *
 * fibbers-nav — thin controller for the singleton bar (body-layer.js). No UI of
 * its own; the bar reserves its own bottom space on the view (view-reserve.js).
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { attach, detach, renderBar } from "../body-layer.js";
import { nav } from "../nav-stack.js";
import "../icon.js";

export class FibbersNav extends LitElement {
  static properties = { preview: { type: Boolean, reflect: true } };
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
          name: "Home",
          icon: "solar:home-2-bold-duotone",
          path: "/lovelace/0",
        },
        {
          name: "Lights",
          icon: "solar:lightbulb-bolt-bold-duotone",
          path: "/lovelace/1",
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
    if (this.isConnected && !this.preview) attach(this, this._config);
  }

  set hass(hass) {
    nav.hassRef = hass;
    if (this._config && (this._config.tabs || []).some((t) => t.badge))
      renderBar();
  }

  connectedCallback() {
    super.connectedCallback();
    // In the card picker HA sets `preview` — never spawn the real body-portal bar.
    if (this.preview) return;
    if (this._config) attach(this, this._config);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    if (!this.preview) detach(this);
  }

  render() {
    if (!this.preview) return html``;
    // Inert inline mock for the card picker — a static bar, no body portal, no
    // singleton. Literal colours (the real bar's palette) so this otherwise
    // UI-less controller needn't pull in Tailwind.
    const tabs = (this._config && this._config.tabs) || [];
    return html`<div
      style="display:flex;gap:2px;background:#1d2426;border:1px solid #262f31;
             border-radius:12px;padding:7px 6px"
    >
      ${tabs.map(
        (tab, i) =>
          html`<div
            style="flex:1;display:flex;flex-direction:column;align-items:center;
                 gap:3px;font:500 10px system-ui;color:${
                   i === 0 ? "#74b98a" : "#8b999c"
                 }"
          >
            <fib-icon
              style="--mdc-icon-size:20px"
              icon=${tab.icon || "solar:widget-bold-duotone"}
            ></fib-icon>
            <span>${tab.name || ""}</span>
          </div>`,
      )}
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
