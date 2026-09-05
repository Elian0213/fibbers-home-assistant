/* ================================================================== *
 * fibbers-back — "Back to X" from the nav stack; `fallback` on cold deep-link.
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";

import { nav, previous, goBack, startNav, stopNav } from "@core/nav-stack";
import { t } from "@shared/i18n";
import { twSheet } from "@shared/tw";
import { norm } from "@shared/util";
import type {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
} from "@/types/home-assistant";
import "@shared/icon";

/** YAML/editor config accepted by `fibbers-back`. */
export interface BackConfig extends LovelaceCardConfig {
  label?: string;
  fallback?: string;
  labels?: Record<string, string>;
  icon?: string;
  language?: string;
}

/**
 * fibbers-back — "Back to X" button driven by the nav stack; falls back to
 * `fallback` on a cold deep-link where there's no history to pop.
 */
@customElement("fibbers-back")
export class FibbersBack extends LitElement implements LovelaceCard {
  @state() private config!: BackConfig;

  @state() private _label = "";

  private _onRoute?: () => void;

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Starter config for the card picker. */
  static getStubConfig(): BackConfig {
    return { type: "custom:fibbers-back", fallback: "/lovelace/0" };
  }

  /** Store config and recompute the label. */
  setConfig(config: BackConfig): void {
    this.config = config || {};
    this._compute();
  }

  /** No-op — the label comes from the nav stack, not hass. */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  set hass(_hass: HomeAssistant | undefined) {}

  /** Start route tracking + subscribe so the label follows the current previous page. */
  connectedCallback(): void {
    super.connectedCallback();
    startNav(); // a back card needs the stack maintained even without a nav bar
    this._onRoute = () => this._compute();
    nav.listeners.add(this._onRoute);
    this._compute();
  }

  /** Drop the subscription and release the route-tracking ref-count. */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._onRoute) nav.listeners.delete(this._onRoute);
    stopNav();
  }

  private _compute(): void {
    const c = this.config || {};
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
  render(): TemplateResult {
    const c = this.config || {};
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
  getCardSize(): number {
    return 1;
  }

  /** Full-width, single-row footprint in the sections/grid layout. */
  getLayoutOptions(): { grid_columns: string; grid_rows: number } {
    return { grid_columns: "full", grid_rows: 1 };
  }

  /** Span the full grid width; height follows content. */
  getGridOptions(): { columns: string; rows: string } {
    return { columns: "full", rows: "auto" };
  }
}
