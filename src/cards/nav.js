/* ================================================================== *
 * CARD — fibbers-nav
 * ================================================================== */
import { nav } from "../nav-stack.js";
import { bar, attach, detach, renderBar } from "../body-layer.js";

export class FibbersNav extends HTMLElement {
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
    this._config = config;
    if (!this._spacer) {
      this._spacer = document.createElement("div");
      this.appendChild(this._spacer);
    }
    this._syncSpacer();
    if (this.isConnected) attach(this, this._config);
  }

  _syncSpacer() {
    if (!this._spacer) return;
    const cfg = this._config || {};
    const offset = Number(cfg.offset_bottom) || 0;
    const base = cfg.reserve != null ? cfg.reserve : bar.height || 74;
    this._spacer.style.height = `${Math.round(base + offset)}px`;
  }

  set hass(hass) {
    nav.hassRef = hass;
    if (this._config && (this._config.tabs || []).some((t) => t.badge))
      renderBar();
  }

  connectedCallback() {
    if (this._config) attach(this, this._config);
  }

  disconnectedCallback() {
    detach(this);
  }

  getCardSize() {
    return 1;
  }

  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
}
