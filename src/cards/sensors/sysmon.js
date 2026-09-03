/* ================================================================== *
 * fibbers-sysmon — host telemetry tiles (cpu/temp/disk/ram/…) + an optional
 * history sparkline (`graph` over `graph_hours`).
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { twSheet } from "../../shared/tw.js";
import {
  fmtNum,
  fmtState,
  isUnavail,
  fetchHistory,
} from "../../shared/util.js";
import "../../shared/icon.js";

const W = 300;

export class FibbersSysmon extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _series: { state: true },
    _settled: { state: true },
  };
  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  static getStubConfig() {
    return {
      type: "custom:fibbers-sysmon",
      title: "Raspberry Pi",
      metrics: [
        { label: "CPU", entity: "sensor.cpu_percent", unit: "%" },
        { label: "Temp", entity: "sensor.cpu_temp", unit: "°C" },
      ],
    };
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.metrics) || !config.metrics.length) {
      throw new Error("fibbers-sysmon: `metrics` must be a non-empty list");
    }
    this._config = config;
    this._series = null;
    this._fetchedFor = null;
    this._lastTry = 0;
    this._fetchedAt = 0;
    this._misses = 0;
    this._settled = false;
    this._gen = (this._gen || 0) + 1; // discard any in-flight fetch for the old config
  }

  updated(changed) {
    if (changed.has("hass") && this._config.graph) this._maybeFetch();
  }
  async _maybeFetch() {
    const id = this._config.graph;
    if (!this.hass || !this.hass.callWS) return;
    const now = Date.now();
    // Cache expiry: refetch when the window is ~a 20th stale (min 60s).
    const maxAge = Math.max(
      60e3,
      ((this._config.graph_hours || 24) * 3600e3) / 20,
    );
    if (this._fetchedFor === id && now - this._fetchedAt < maxAge) return;
    // Fast retry on a cold miss (recorder lag); slow 8s backoff only once we have a
    // series (a genuinely history-less entity).
    const backoff = this._series
      ? 8000
      : Math.min(500 * 2 ** this._misses, 8000);
    if (this._lastTry && now - this._lastTry < backoff) return;
    this._lastTry = now;
    const gen = (this._gen += 1);
    try {
      const nums = await fetchHistory(
        this.hass,
        id,
        this._config.graph_hours || 24,
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

  _val(m) {
    const st = this.hass && this.hass.states[m.entity];
    if (isUnavail(st)) return { text: "—", unit: "" };
    const n = Number(st.state);
    if (!Number.isFinite(n)) return { text: fmtState(this.hass, st), unit: "" };
    const unit =
      m.unit != null ? m.unit : st.attributes.unit_of_measurement || "";
    return { text: fmtNum(this.hass, n, m.decimals), unit };
  }

  _sparkline() {
    const series = this._series;
    if (!series || series.length < 2) {
      // A configured sparkline that hasn't loaded yet gets a skeleton (not a
      // collapsed gap); no `graph:` at all renders nothing.
      if (!this._config.graph || this._settled) return "";
      return html`<div
        class="mt-3 h-10 animate-pulse rounded-[6px] bg-card2"
      ></div>`;
    }
    const h = 40;
    let min = Math.min(...series),
      max = Math.max(...series);
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

  render() {
    const cfg = this._config;
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

  getCardSize() {
    return 3;
  }
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 3 };
  }
  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }
}
