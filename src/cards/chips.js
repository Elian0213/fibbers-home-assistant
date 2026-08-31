/* ================================================================== *
 * CARD — fibbers-chips
 *
 * A pill row. Each chip carries a standard HA action object; an optional
 * `active_when: {entity, state}` gives it a blue tint while that state holds.
 * ================================================================== */
import { styleBlock } from "../tokens.js";
import { runAction } from "../actions.js";

export class FibbersChips extends HTMLElement {
  static getStubConfig() {
    return {
      type: "custom:fibbers-chips",
      chips: [
        {
          name: "Alles uit",
          icon: "solar:power-bold-duotone",
          action: { action: "toggle" },
        },
      ],
    };
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.chips)) {
      throw new Error("fibbers-chips: `chips` must be a list");
    }
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._paintActive();
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        ${styleBlock()}
        * { box-sizing: border-box; }
        .row { display: flex; flex-wrap: wrap; gap: 7px; }
        .chip {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 10.5px; font-weight: 500;
          color: var(--fib-ink-2);
          background: var(--fib-card-2);
          border: 1px solid var(--fib-line);
          border-radius: 999px;
          padding: 5px 10px;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .chip[data-active="true"] {
          color: var(--fib-blue-ink);
          background: var(--fib-blue-bg);
          border-color: var(--fib-blue-line);
        }
        .chip fib-icon { --mdc-icon-size: 13px; width: 13px; height: 13px; }
      </style>
      <div class="row"></div>`;
    const row = this.shadowRoot.querySelector(".row");
    this._config.chips.forEach((chip, i) => {
      const el = document.createElement("button");
      el.className = "chip";
      el.type = "button";
      el.dataset.i = String(i);
      if (chip.icon) {
        const ic = document.createElement("fib-icon");
        ic.setAttribute("icon", chip.icon);
        el.appendChild(ic);
      }
      const span = document.createElement("span");
      span.textContent = chip.name || "";
      el.appendChild(span);
      el.addEventListener("click", () => {
        if (this._hass)
          runAction(
            chip.action || chip.tap_action,
            this._hass,
            this,
            chip.entity,
          );
      });
      row.appendChild(el);
    });
    this._paintActive();
  }

  _paintActive() {
    if (!this.shadowRoot || !this._hass) return;
    this.shadowRoot.querySelectorAll(".chip").forEach((el) => {
      const chip = this._config.chips[+el.dataset.i];
      const aw = chip.active_when;
      let active = false;
      if (aw && aw.entity) {
        const st = this._hass.states[aw.entity];
        active =
          st && (aw.state != null ? st.state === aw.state : st.state === "on");
      }
      el.setAttribute("data-active", String(!!active));
    });
  }

  getCardSize() {
    return 1;
  }

  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
}
