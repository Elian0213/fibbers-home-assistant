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
import { fmtNum, fetchHistory, pickEntity } from "@shared/util";
import type {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
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
  language?: string;
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

/**
 * fibbers-graph — single-entity history sparkline with min/max labels. History
 * is fetched over the last `hours`; a literal `data: [numbers]` overrides it.
 */
@customElement("fibbers-graph")
export class FibbersGraph extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config!: GraphConfig;

  @state() private _series: number[] | null = null;

  @state() private _settled = false;

  private _fetchedFor?: string | null;

  private _lastTry = 0;

  private _fetchedAt = 0;

  private _misses = 0;

  private _gen = 0;

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
    this._series = Array.isArray(config.data)
      ? config.data.map(Number).filter(Number.isFinite)
      : null;
    this._fetchedFor = null;
    this._lastTry = 0;
    this._fetchedAt = 0;
    this._misses = 0;
    this._settled = this._series != null; // literal `data:` is already "loaded"
    this._gen = (this._gen || 0) + 1; // discard any in-flight fetch for the old config
  }

  /** On each hass push, refresh the history series (skipped for literal `data:`). */
  updated(changed: PropertyValues): void {
    if (changed.has("hass") && this.config.entity && !this.config.data)
      this._maybeFetch();
  }

  private async _maybeFetch(): Promise<void> {
    const id = this.config.entity;
    if (!id || !this.hass || !this.hass.callWS) return;
    const now = Date.now();
    // Cache expiry: refetch when the window is ~a 20th stale (min 60s), so a wall
    // tablet's "last 24h" curve isn't frozen at page-load forever.
    const maxAge = Math.max(60e3, ((this.config.hours || 24) * 3600e3) / 20);
    if (this._fetchedFor === id && now - this._fetchedAt < maxAge) return;
    // Fast retry on a cold miss (recorder lag); slow 8s backoff only once we have a
    // series (a genuinely history-less entity).
    const backoff = this._series
      ? 8000
      : Math.min(500 * 2 ** this._misses, 8000);
    if (this._lastTry && now - this._lastTry < backoff) return;
    this._lastTry = now;
    // eslint-disable-next-line no-multi-assign -- bump the fetch generation and capture it in one step
    const gen = (this._gen += 1);
    try {
      const nums = await fetchHistory(this.hass, id, this.config.hours || 24);
      if (gen !== this._gen) return; // a newer config/fetch superseded this one
      if (nums.length) {
        this._series = nums;
        this._fetchedFor = id;
        this._fetchedAt = Date.now();
        this._misses = 0;
      } else {
        this._misses += 1;
      }
    } catch (_e) {
      if (gen === this._gen) this._misses += 1;
    } finally {
      if (gen === this._gen) this._settled = true;
    }
  }

  private _current(): number | null {
    const st =
      this.config.entity && this.hass && this.hass.states[this.config.entity];
    if (st && st.state !== "unavailable" && st.state !== "unknown") {
      const n = Number(st.state);
      if (Number.isFinite(n)) return n;
    }
    return this._series && this._series.length
      ? this._series[this._series.length - 1]
      : null;
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
    const series = this._series;
    if (!series || series.length < 2) {
      const hl = cfg.language || this.hass;
      // Until a fetch actually settles, show a skeleton — not "no history", which
      // used to flash on every cold load while the recorder was still answering.
      return this._settled
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
    let min = Math.min(...series);
    let max = Math.max(...series);
    const pad = (max - min || 1) * 0.12;
    min -= pad;
    max += pad;
    const n = series.length;
    const x = (i: number): number => (i / (n - 1)) * W;
    const y = (v: number): number => h - ((v - min) / (max - min || 1)) * h;
    const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const line = `M${pts.join(" L")}`;
    const area = `M0,${h} L${pts.join(" L")} L${W},${h} Z`;
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
    const series = this._series;
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

  /** Legacy sections-view sizing (grid_columns/grid_rows). */
  getLayoutOptions(): { grid_columns: number; grid_rows: number } {
    return { grid_columns: 6, grid_rows: 2 };
  }

  /** Current sections-view sizing — half-width, auto height, min 3 columns. */
  getGridOptions(): { columns: number; rows: string; min_columns: number } {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }
}
