/* ================================================================== *
 * CARD — fibbers-section
 *
 * The uppercase mono section label. Replaces the HA `heading` card plus its
 * card-mod block. Nothing else.
 * ================================================================== */
import { styleBlock } from "../tokens.js";

export class FibbersSection extends HTMLElement {
  static getStubConfig() {
    return { type: "custom:fibbers-section", label: "Kamers" };
  }

  setConfig(config) {
    if (!config || !config.label) {
      throw new Error("fibbers-section: `label` is required");
    }
    this._config = config;
    this._render();
  }

  set hass(_hass) {}

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        ${styleBlock()}
        .label {
          font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
          font-size: 9.5px;
          font-weight: 500;
          letter-spacing: .11em;
          text-transform: uppercase;
          color: var(--fib-muted);
          padding: 2px 2px 0;
        }
      </style>
      <div class="label"></div>`;
    this.shadowRoot.querySelector(".label").textContent = this._config.label;
  }

  getCardSize() {
    return 1;
  }

  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
}
