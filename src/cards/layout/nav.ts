/* ================================================================== *
 * fibbers-nav — thin controller for the singleton bar (body-layer.js). No UI of
 * its own; the bar reserves its own bottom space on the view (view-reserve.js).
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { attach, detach, renderBar, type NavConfig } from "@core/body-layer";
import { updateOpenModalHass } from "@core/body-sheet";
import { nav } from "@core/nav-stack";
import type {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
} from "@/types/home-assistant";
import "@shared/icon";

const EDITOR_SCHEMA = [
  {
    name: "theme",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "none", label: "None" },
          { value: "fibbers", label: "Fibbers (dark)" },
          { value: "fibbers-light", label: "Fibbers Light" },
          { value: "auto", label: "Auto" },
          {
            value: "fibbers-global",
            label: "Fibbers Global (this browser session)",
          },
          {
            value: "fibbers-global-light",
            label: "Fibbers Global Light (session)",
          },
        ],
      },
    },
  },
  { name: "respect_sidebar", selector: { boolean: {} } },
  { name: "more_info", selector: { boolean: {} } },
  { name: "offset_bottom", selector: { number: { min: 0, mode: "box" } } },
  { name: "extra_bottom", selector: { number: { min: 0, mode: "box" } } },
];

/** YAML/editor config accepted by `fibbers-nav` (a superset of the bar's config). */
export interface NavCardConfig extends LovelaceCardConfig, NavConfig {}

/**
 * fibbers-nav — thin controller for the singleton bottom bar (core/body-layer.js);
 * no UI of its own, it just attaches/detaches the body-portal bar.
 */
@customElement("fibbers-nav")
export class FibbersNav extends LitElement implements LovelaceCard {
  @property({ type: Boolean, reflect: true }) preview = false;

  @state() private config!: NavCardConfig;

  private _cell: HTMLElement | null = null;

  static styles = [
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Two-tab starter config for the card picker. */
  static getStubConfig(): NavCardConfig {
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

  /** Return the shared form editor, wired to this card's schema. */
  static getConfigElement(): LovelaceCardEditor {
    const el = document.createElement(
      "fibbers-form-editor",
    ) as LovelaceCardEditor & {
      schema?: unknown;
    };
    el.schema = EDITOR_SCHEMA;
    return el;
  }

  /** Validate config, stash it, and (re)attach the bar when already live and not previewing. */
  setConfig(config: NavCardConfig): void {
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
    if (config.more_info != null && typeof config.more_info !== "boolean") {
      throw new Error("fibbers-nav: `more_info` must be true or false");
    }
    if (
      config.theme != null &&
      ![
        "none",
        "fibbers",
        "fibbers-light",
        "auto",
        "fibbers-global",
        "fibbers-global-light",
      ].includes(config.theme)
    ) {
      throw new Error(
        'fibbers-nav: `theme` must be "fibbers", "fibbers-light", "auto", ' +
          '"fibbers-global", "fibbers-global-light", or "none"',
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
    this.config = config;
    if (this.isConnected && !this.preview) attach(this, this.config);
  }

  /** Feed hass to the nav stack; only re-render the bar when a tab carries a live badge. */
  set hass(hass: HomeAssistant) {
    if (this.preview) return; // card picker: never touch the nav singleton
    nav.hassRef = hass;
    updateOpenModalHass(hass); // keep an open Fibbers more-info modal live
    if (this.config && (this.config.tabs || []).some((t) => t.badge))
      renderBar();
  }

  /** Collapse the empty <hui-card> wrapper (bar lives in document.body) and attach the bar. */
  connectedCallback(): void {
    super.connectedCallback();
    // Card picker sets `preview` — never spawn the real body-portal bar.
    if (this.preview) return;
    // Bar renders into document.body, so this grid cell is empty — collapse the
    // <hui-card> wrapper so it doesn't reserve a 56px row.
    const cell = (this.getRootNode() as ShadowRoot).host as HTMLElement | null;
    if (cell) {
      this._cell = cell;
      cell.style.display = "none";
    }
    if (this.config) attach(this, this.config);
  }

  /** Restore the collapsed wrapper and detach the singleton bar. */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._cell) {
      this._cell.style.display = "";
      this._cell = null;
    }
    if (!this.preview) detach(this);
  }

  /** Nothing in normal use (bar is a body portal); an inert mock bar in the picker. */
  render(): TemplateResult {
    if (!this.preview) return html``;
    // Inert inline mock for the card picker — a static bar, no body portal, no
    // singleton. Literal colours (the real bar's palette) so this otherwise
    // UI-less controller needn't pull in Tailwind.
    const tabs = (this.config && this.config.tabs) || [];
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

  /** One masonry row — the collapsed wrapper takes no visible space. */
  getCardSize(): number {
    return 1;
  }

  /** Full-width, single-row footprint in the sections/grid layout. */
  getLayoutOptions(): { grid_columns: string; grid_rows: number } {
    return { grid_columns: "full", grid_rows: 1 };
  }

  /** Pin to a 1×1 minimum so the invisible controller never stretches the grid. */
  getGridOptions(): {
    columns: number;
    rows: number;
    min_columns: number;
    min_rows: number;
  } {
    return { columns: 1, rows: 1, min_columns: 1, min_rows: 1 };
  }
}
