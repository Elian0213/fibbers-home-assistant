/* ================================================================== *
 * fibbers-back — "Back to X" from the nav stack; `fallback` on cold deep-link.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import {
  nav,
  previous,
  goBack,
  startNav,
  stopNav,
} from "../../core/nav-stack.js";
import { t } from "../../shared/i18n.js";
import { twSheet } from "../../shared/tw.js";
import { norm } from "../../shared/util.js";
import "../../shared/icon.js";

/**
 * fibbers-back — "Back to X" button driven by the nav stack; falls back to
 * `fallback` on a cold deep-link where there's no history to pop.
 */
export class FibbersBack extends LitElement {
  static properties = {
    _config: { state: true },
    _label: { state: true },
  };
  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Starter config for the card picker. */
  static getStubConfig() {
    return { type: "custom:fibbers-back", fallback: "/lovelace/0" };
  }

  /** Store config and recompute the label. */
  setConfig(config) {
    this._config = config || {};
    this._compute();
  }

  /** No-op — the label comes from the nav stack, not hass. */
  set hass(_hass) {}

  /** Start route tracking + subscribe so the label follows the current previous page. */
  connectedCallback() {
    super.connectedCallback();
    startNav(); // a back card needs the stack maintained even without a nav bar
    this._onRoute = () => this._compute();
    nav.listeners.add(this._onRoute);
    this._compute();
  }
  /** Drop the subscription and release the route-tracking ref-count. */
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._onRoute) nav.listeners.delete(this._onRoute);
    stopNav();
  }

  _compute() {
    const c = this._config || {};
    if (c.label) {
      this._label = c.label;
      return;
    }
    const prev = previous() || c.fallback;
    const names = c.labels || {};
    const name = prev ? names[norm(prev)] || names[prev] : null;
    const hl = c.language || nav.hassRef;
    this._label = name ? t(hl, "back.back_to", { name }) : t(hl, "back.back");
  }

  /** Full-width back button; tap pops the nav stack (or routes to `fallback`). */
  render() {
    const c = this._config || {};
    return html`<button
      type="button"
      class="flex w-full items-center gap-2 rounded-xl border border-line bg-card
             px-3.5 py-3 text-[12.5px] font-medium text-ink2 active:bg-card2"
      @click=${() => goBack(c.fallback)}
    >
      <fib-icon
        class="h-[18px] w-[18px] [--mdc-icon-size:18px] text-muted"
        icon=${c.icon || "solar:alt-arrow-left-bold-duotone"}
      ></fib-icon>
      <span>${this._label}</span>
    </button>`;
  }

  /** One masonry row. */
  getCardSize() {
    return 1;
  }
  /** Full-width, single-row footprint in the sections/grid layout. */
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
  /** Span the full grid width; height follows content. */
  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }
}
