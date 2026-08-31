/* ================================================================== *
 * CARD — fibbers-back
 * ================================================================== */
import { T } from "../tokens.js";
import { norm } from "../util.js";
import { nav, previous, goBack } from "../nav-stack.js";

export class FibbersBack extends HTMLElement {
  static getStubConfig() {
    return { type: "custom:fibbers-back", fallback: "/dashboard-thuis/huis" };
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
    this._onRoute = () => this._label();
    nav.listeners.add(this._onRoute);
  }

  set hass(_hass) {}

  _render() {
    const c = this._config;
    this.innerHTML = `
      <style>
        .row {
          display: flex; align-items: center; gap: 8px;
          background: ${T.card}; border: 1px solid ${T.line};
          border-radius: 12px; padding: 12px 14px;
          color: ${T.ink2}; font-size: 12.5px; font-weight: 500;
          cursor: pointer; -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .row[data-pressed="true"] { background: ${T.card2}; }
        .row fib-icon { --mdc-icon-size: 18px; width: 18px; height: 18px; color: ${T.muted}; }
      </style>
      <div class="row" role="button" tabindex="0">
        <fib-icon icon="${c.icon || "solar:alt-arrow-left-bold-duotone"}"></fib-icon>
        <span class="lbl"></span>
      </div>`;
    const row = this.querySelector(".row");
    row.addEventListener("pointerdown", () =>
      row.setAttribute("data-pressed", "true"),
    );
    ["pointerup", "pointercancel", "pointerleave"].forEach((ev) =>
      row.addEventListener(ev, () => row.removeAttribute("data-pressed")),
    );
    const go = () => goBack(this._config.fallback);
    row.addEventListener("click", go);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        go();
      }
    });
    this._label();
  }

  /** "Terug naar X", where X is where you actually came from */
  _label() {
    const el = this.querySelector(".lbl");
    if (!el) return;
    const c = this._config;
    if (c.label) {
      el.textContent = c.label;
      return;
    }
    const prev = previous() || c.fallback;
    const names = c.labels || {};
    const name = prev ? names[norm(prev)] || names[prev] : null;
    el.textContent = name ? `Terug naar ${name}` : "Terug";
  }

  disconnectedCallback() {
    if (this._onRoute) nav.listeners.delete(this._onRoute);
  }

  getCardSize() {
    return 1;
  }

  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
}
