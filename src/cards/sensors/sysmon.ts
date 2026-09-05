/* ================================================================== *
 * fibbers-sysmon — host telemetry tiles (cpu/temp/disk/ram/…) + an optional
 * history sparkline (`graph` over `graph_hours`).
 * ================================================================== */
import {
  LitElement,
  html,
  css,
  type TemplateResult,
  type PropertyValues,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { twSheet } from "@shared/tw";
import { fmtNum, fmtState, isUnavail, fetchHistory } from "@shared/util";
import type {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
} from "@/types/home-assistant";
import "@shared/icon";

/** A single telemetry metric in a `fibbers-sysmon` config. */
export interface SysmonMetric {
  label?: string;
  entity: string;
  unit?: string;
  icon?: string;
  decimals?: number;
}

/** YAML/editor config accepted by `fibbers-sysmon`. */
export interface SysmonConfig extends LovelaceCardConfig {
  metrics: SysmonMetric[];
  title?: string;
  graph?: string;
  graph_hours?: number;
}

const W = 300;

/**
 * fibbers-sysmon — host telemetry tiles (cpu/temp/disk/ram/…) plus an optional
 * history sparkline (`graph` over `graph_hours`).
 */
@customElement("fibbers-sysmon")
export class FibbersSysmon extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config!: SysmonConfig;

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

  /** Seed config for the card picker — two example metrics. */
  static getStubConfig(): SysmonConfig {
    return {
      type: "custom:fibbers-sysmon",
      title: "Raspberry Pi",
      metrics: [
        { label: "CPU", entity: "sensor.cpu_percent", unit: "%" },
        { label: "Temp", entity: "sensor.cpu_temp", unit: "°C" },
      ],
    };
  }

  /** Validate + store the config, resetting fetch bookkeeping; throws on an empty `metrics` list so the editor surfaces it. */
  setConfig(config: SysmonConfig): void {
    if (!config || !Array.isArray(config.metrics) || !config.metrics.length) {
      throw new Error("fibbers-sysmon: `metrics` must be a non-empty list");
    }
    this.config = config;
    this._series = null;
    this._fetchedFor = null;
    this._lastTry = 0;
    this._fetchedAt = 0;
    this._misses = 0;
    this._settled = false;
    this._gen = (this._gen || 0) + 1; // discard any in-flight fetch for the old config
  }

  /** On each hass push, refresh the sparkline history (only when `graph` is set). */
  updated(changed: PropertyValues): void {
    if (changed.has("hass") && this.config.graph) this._maybeFetch();
  }

  private async _maybeFetch(): Promise<void> {
    const id = this.config.graph;
    if (!id || !this.hass || !this.hass.callWS) return;
    const now = Date.now();
    // Cache expiry: refetch when the window is ~a 20th stale (min 60s).
    const maxAge = Math.max(
      60e3,
      ((this.config.graph_hours || 24) * 3600e3) / 20,
    );
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
      const nums = await fetchHistory(
        this.hass,
        id,
        this.config.graph_hours || 24,
      );
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

  private _val(m: SysmonMetric): { text: string; unit: string } {
    const st = this.hass && this.hass.states[m.entity];
    if (isUnavail(st)) return { text: "—", unit: "" };
    const n = Number(st!.state);
    if (!Number.isFinite(n)) return { text: fmtState(this.hass, st), unit: "" };
    const unit =
      m.unit != null ? m.unit : st!.attributes.unit_of_measurement || "";
    return { text: fmtNum(this.hass, n, m.decimals), unit };
  }

  private _sparkline(): TemplateResult | string {
    const series = this._series;
    if (!series || series.length < 2) {
      // A configured sparkline that hasn't loaded yet gets a skeleton (not a
      // collapsed gap); no `graph:` at all renders nothing.
      if (!this.config.graph || this._settled) return "";
      return html`<div
        class="mt-3 h-10 animate-pulse rounded-[6px] bg-card2"
      ></div>`;
    }
    const h = 40;
    let min = Math.min(...series);
    let max = Math.max(...series);
    const pad = (max - min || 1) * 0.12;
    min -= pad;
    max += pad;
    const n = series.length;
    const pts = series.map(
      (v, i) =>
        `${((i / (n - 1)) * W).toFixed(1)},${(h - ((v - min) / (max - min || 1)) * h).toFixed(1)}`,
    );
    return html`<svg
      viewBox="0 0 ${W} ${h}"
      preserveAspectRatio="none"
      class="mt-3 block w-full text-blue"
      style="height:${h}px"
    >
      <path
        d="M0,${h} L${pts.join(" L")} L${W},${h} Z"
        style="fill:currentColor;opacity:.12"
      ></path>
      <path
        d="M${pts.join(" L")}"
        style="fill:none;stroke:currentColor;stroke-width:2;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke"
      ></path>
    </svg>`;
  }

  /** Render the metric grid and, if configured, the history sparkline below it. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    return html`<div class="rounded-[14px] border border-line bg-card p-[13px]">
      ${
        cfg.title
          ? html`<div
              class="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
            >
              ${cfg.title}
            </div>`
          : ""
      }
      <div class="grid grid-cols-2 gap-2">
        ${cfg.metrics.map((m) => {
          const v = this._val(m);
          return html`<div
            class="flex items-center gap-2.5 rounded-[10px] bg-card2 px-2.5 py-2"
          >
            <fib-icon
              class="h-[18px] w-[18px] flex-none [--mdc-icon-size:18px] text-muted"
              icon=${m.icon || "solar:widget-bold-duotone"}
            ></fib-icon>
            <div class="min-w-0">
              <div class="text-[10px] text-muted">${m.label || m.entity}</div>
              <div class="text-[15px] font-semibold text-ink">
                ${v.text}<span class="ml-0.5 text-[10px] font-medium text-ink2"
                  >${v.unit}</span
                >
              </div>
            </div>
          </div>`;
        })}
      </div>
      ${this._sparkline()}
    </div>`;
  }

  /** Masonry height in rows. */
  getCardSize(): number {
    return 3;
  }

  /** Legacy sections-view sizing (grid_columns/grid_rows). */
  getLayoutOptions(): { grid_columns: string; grid_rows: number } {
    return { grid_columns: "full", grid_rows: 3 };
  }

  /** Current sections-view sizing — full width, auto height. */
  getGridOptions(): { columns: string; rows: string } {
    return { columns: "full", rows: "auto" };
  }
}
