/* ================================================================== *
 * fibbers-graph — single-entity history sparkline with min/max labels. History
 * is fetched over the last `hours`; a literal `data: [numbers]` overrides it.
 * ================================================================== */
import {
  LitElement,
  html,
  css,
  type TemplateResult,
  type PropertyValues,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { t } from "@shared/i18n";
import { cardShell } from "@shared/shells";
import { twSheet } from "@shared/tw";
import { ThemeController } from "@shared/theme-host";
import { HistoryController, sparklinePaths } from "@shared/history";
import { fmtNum, isUnavail, pickEntity } from "@shared/util";
import type {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
} from "@/types/home-assistant";

/** YAML/editor config accepted by `fibbers-graph`. */
export interface GraphConfig extends LovelaceCardConfig {
  entity?: string;
  data?: number[];
  name?: string;
  hours?: number;
  color?: string;
  unit?: string;
  height?: number;
  decimals?: number;
  fill?: boolean;
  show_stats?: boolean;
}

const COLORS = ["accent", "amber", "blue", "green", "red"];
/* Full class strings so Tailwind's scanner emits every one — a dynamic
   `text-${color}` would purge the colours not used literally elsewhere. */
const STROKE: Record<string, string> = {
  accent: "text-accent",
  amber: "text-amber",
  blue: "text-blue",
  green: "text-green",
  red: "text-red",
};
const W = 300;

// ha-form schema for the visual editor. Unlisted keys (data, height, grid
// options) pass through untouched — a YAML config round-trips.
const EDITOR_SCHEMA = [
  { name: "entity", selector: { entity: {} } },
  { name: "name", selector: { text: {} } },
  { name: "hours", selector: { number: { min: 1, max: 168, mode: "box" } } },
  { name: "decimals", selector: { number: { min: 0, max: 4, mode: "box" } } },
  {
    name: "color",
    selector: {
      select: {
        mode: "dropdown",
        options: COLORS.map((c) => ({ value: c, label: c })),
      },
    },
  },
  { name: "unit", selector: { text: {} } },
  { name: "show_stats", selector: { boolean: {} } },
  { name: "fill", selector: { boolean: {} } },
];

/**
 * fibbers-graph — single-entity history sparkline with min/max labels. History
 * is fetched over the last `hours`; a literal `data: [numbers]` overrides it.
 */
@customElement("fibbers-graph")
export class FibbersGraph extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  _theme = new ThemeController(this);

  @state() private config!: GraphConfig;

  private _history = new HistoryController(this);

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Seed config for the card picker — picks a real sensor if one exists, defaults to 24h. */
  static getStubConfig(
    _hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[],
  ): GraphConfig {
    return {
      type: "custom:fibbers-graph",
      entity: pickEntity(
        "sensor",
        entities,
        entitiesFallback,
        "sensor.example",
      ),
      hours: 24,
    };
  }

  /** Visual editor element, wired to EDITOR_SCHEMA. */
  static getConfigElement(): LovelaceCardEditor {
    const el = document.createElement(
      "fibbers-form-editor",
    ) as LovelaceCardEditor & {
      schema?: unknown;
    };
    el.schema = EDITOR_SCHEMA;
    return el;
  }

  /** Validate + store the config, resetting fetch bookkeeping; throws on a missing source or bad `color` so the editor surfaces it. */
  setConfig(config: GraphConfig): void {
    if (!config || (!config.entity && !Array.isArray(config.data))) {
      throw new Error("fibbers-graph: `entity` or `data` is required");
    }
    if (config.color != null && !COLORS.includes(config.color)) {
      throw new Error(
        `fibbers-graph: \`color\` must be one of ${COLORS.join(", ")}`,
      );
    }
    this.config = config;
    this._history.reset(
      Array.isArray(config.data)
        ? config.data.map(Number).filter(Number.isFinite)
        : null,
    );
  }

  /** On each hass push, refresh the history series (skipped for literal `data:`). */
  updated(changed: PropertyValues): void {
    if (changed.has("hass") && this.config.entity && !this.config.data)
      this._history.fetch(
        this.hass,
        this.config.entity,
        this.config.hours || 24,
      );
  }

  private _current(): number | null {
    const st =
      this.config.entity && this.hass && this.hass.states[this.config.entity];
    if (st && !isUnavail(st)) {
      const n = Number(st.state);
      if (Number.isFinite(n)) return n;
    }
    const { series } = this._history;
    return series && series.length ? series[series.length - 1] : null;
  }

  private _unit(): string {
    if (this.config.unit != null) return this.config.unit;
    const st =
      this.config.entity && this.hass && this.hass.states[this.config.entity];
    return (st && st.attributes.unit_of_measurement) || "";
  }

  // --- render helpers ------------------------------------------------

  private _renderHeader(name: string | undefined): TemplateResult {
    const cfg = this.config;
    const now = this._current();
    return html`<div class="mb-2 flex items-baseline justify-between gap-2">
      <span class="text-[11px] font-medium text-muted">${name}</span>
      <span class="text-[15px] font-semibold text-ink">
        ${now != null ? fmtNum(this.hass, now, cfg.decimals) : "—"}<span
          class="ml-0.5 text-[11px] font-medium text-ink2"
          >${this._unit()}</span
        >
      </span>
    </div>`;
  }

  private _renderBody(h: number): TemplateResult {
    const cfg = this.config;
    const { series, settled } = this._history;
    if (!series || series.length < 2) {
      const hl = this.hass;
      // Until a fetch actually settles, show a skeleton — not "no history", which
      // used to flash on every cold load while the recorder was still answering.
      return settled
        ? html`<div
            class="flex items-center text-[11px] text-muted"
            style="height:${h}px"
          >
            ${t(hl, "graph.no_history")}
          </div>`
        : html`<div
            class="animate-pulse rounded-[6px] bg-card2"
            style="height:${h}px"
          ></div>`;
    }
    const { line, area } = sparklinePaths(series, W, h);
    const colorCls = STROKE[cfg.color || "accent"] || "text-accent";
    return html`<svg
      viewBox="0 0 ${W} ${h}"
      preserveAspectRatio="none"
      class="block w-full ${colorCls}"
      style="height:${h}px;overflow:visible"
    >
      <path
        d=${area}
        style="fill:currentColor;opacity:${cfg.fill === false ? 0 : 0.12}"
      ></path>
      <path
        d=${line}
        style="fill:none;stroke:currentColor;stroke-width:2;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke"
      ></path>
    </svg>`;
  }

  private _renderStats(): TemplateResult | string {
    const cfg = this.config;
    const { series } = this._history;
    if (!cfg.show_stats || !series || series.length < 2) return "";
    return html`<div
      class="mt-1.5 flex justify-between text-[9.5px] text-muted"
    >
      <span>min ${fmtNum(this.hass, Math.min(...series), cfg.decimals)}</span>
      <span>max ${fmtNum(this.hass, Math.max(...series), cfg.decimals)}</span>
    </div>`;
  }

  /** Render the sparkline (or a loading skeleton / no-history line) plus header and optional min/max. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const st = cfg.entity && this.hass && this.hass.states[cfg.entity];
    const name = cfg.name || (st && st.attributes.friendly_name) || cfg.entity;
    const h = cfg.height || 46;
    return cardShell(
      html`${this._renderHeader(name)}${this._renderBody(h)}${this._renderStats()}`,
    );
  }

  /** Masonry height in rows. */
  getCardSize(): number {
    return 2;
  }

  /** Current sections-view sizing — half-width, auto height, min 3 columns. */
  getGridOptions(): { columns: number; rows: string; min_columns: number } {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }
}
