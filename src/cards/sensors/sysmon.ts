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

import { cardShell, sectionLabel } from "@shared/shells";
import { twSheet } from "@shared/tw";
import { ThemeController } from "@shared/theme-host";
import { HistoryController, sparklinePaths } from "@shared/history";
import { fmtNum, fmtState, isUnavail } from "@shared/util";
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

  _theme = new ThemeController(this);

  @state() private config!: SysmonConfig;

  private _history = new HistoryController(this);

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
    this._history.reset();
  }

  /** On each hass push, refresh the sparkline history (only when `graph` is set). */
  updated(changed: PropertyValues): void {
    if (changed.has("hass") && this.config.graph)
      this._history.fetch(
        this.hass,
        this.config.graph,
        this.config.graph_hours || 24,
      );
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
    const { series, settled } = this._history;
    if (!series || series.length < 2) {
      // A configured sparkline that hasn't loaded yet gets a skeleton (not a
      // collapsed gap); no `graph:` at all renders nothing.
      if (!this.config.graph || settled) return "";
      return html`<div
        class="mt-3 h-10 animate-pulse rounded-[6px] bg-card2"
      ></div>`;
    }
    const h = 40;
    const { line, area } = sparklinePaths(series, W, h);
    return html`<svg
      viewBox="0 0 ${W} ${h}"
      preserveAspectRatio="none"
      class="mt-3 block w-full text-blue"
      style="height:${h}px"
    >
      <path d=${area} style="fill:currentColor;opacity:.12"></path>
      <path
        d=${line}
        style="fill:none;stroke:currentColor;stroke-width:2;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke"
      ></path>
    </svg>`;
  }

  private _renderMetric(m: SysmonMetric): TemplateResult {
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
  }

  /** Render the metric grid and, if configured, the history sparkline below it. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    return cardShell(
      html`${cfg.title ? sectionLabel(cfg.title, { cls: "mb-2.5" }) : ""}
        <div class="grid grid-cols-2 gap-2">
          ${cfg.metrics.map((m) => this._renderMetric(m))}
        </div>
        ${this._sparkline()}`,
    );
  }

  /** Masonry height in rows. */
  getCardSize(): number {
    return 3;
  }

  /** Current sections-view sizing — full width, auto height. */
  getGridOptions(): { columns: string; rows: string } {
    return { columns: "full", rows: "auto" };
  }
}
