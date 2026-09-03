/* ================================================================== *
 * fibbers-graph — single-entity history sparkline with min/max labels. History
 * is fetched over the last `hours`; a literal `data: [numbers]` overrides it.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t } from "../../shared/i18n.js";
import { twSheet } from "../../shared/tw.js";
import { fmtNum, fetchHistory, pickEntity } from "../../shared/util.js";

const COLORS = ["accent", "amber", "blue", "green", "red"];
/* Full class strings so Tailwind's scanner emits every one — a dynamic
   `text-${color}` would purge the colours not used literally elsewhere. */
const STROKE = {
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
export class FibbersGraph extends LitElement {
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

  /** Seed config for the card picker — picks a real sensor if one exists, defaults to 24h. */
  static getStubConfig(hass, entities, entitiesFallback) {
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
  setConfig(config) {
    if (!config || (!config.entity && !Array.isArray(config.data))) {
      throw new Error("fibbers-graph: `entity` or `data` is required");
    }
    if (config.color != null && !COLORS.includes(config.color)) {
      throw new Error(
        `fibbers-graph: \`color\` must be one of ${COLORS.join(", ")}`,
      );
    }
    this._config = config;
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
  updated(changed) {
    if (changed.has("hass") && this._config.entity && !this._config.data)
      this._maybeFetch();
  }

  async _maybeFetch() {
    const id = this._config.entity;
    if (!this.hass || !this.hass.callWS) return;
    const now = Date.now();
    // Cache expiry: refetch when the window is ~a 20th stale (min 60s), so a wall
    // tablet's "last 24h" curve isn't frozen at page-load forever.
    const maxAge = Math.max(60e3, ((this._config.hours || 24) * 3600e3) / 20);
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
      const nums = await fetchHistory(this.hass, id, this._config.hours || 24);
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

  _current() {
    const st =
      this._config.entity && this.hass && this.hass.states[this._config.entity];
    if (st && st.state !== "unavailable" && st.state !== "unknown") {
      const n = Number(st.state);
      if (Number.isFinite(n)) return n;
    }
    return this._series && this._series.length
      ? this._series[this._series.length - 1]
      : null;
  }
  _unit() {
    if (this._config.unit != null) return this._config.unit;
    const st =
      this._config.entity && this.hass && this.hass.states[this._config.entity];
    return (st && st.attributes.unit_of_measurement) || "";
  }

  /** Render the sparkline (or a loading skeleton / no-history line) plus header and optional min/max. */
  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const st = cfg.entity && this.hass && this.hass.states[cfg.entity];
    const name = cfg.name || (st && st.attributes.friendly_name) || cfg.entity;
    const hl = cfg.language || this.hass;
    const now = this._current();
    const h = cfg.height || 46;
    const series = this._series;
    const color = cfg.color || "accent";
    const colorCls = STROKE[color] || "text-accent";

    let body;
    if (!series || series.length < 2) {
      // Until a fetch actually settles, show a skeleton — not "no history", which
      // used to flash on every cold load while the recorder was still answering.
      body = this._settled
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
    } else {
      let min = Math.min(...series);
      let max = Math.max(...series);
      const pad = (max - min || 1) * 0.12;
      min -= pad;
      max += pad;
      const n = series.length;
      const x = (i) => (i / (n - 1)) * W;
      const y = (v) => h - ((v - min) / (max - min || 1)) * h;
      const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      const line = `M${pts.join(" L")}`;
      const area = `M0,${h} L${pts.join(" L")} L${W},${h} Z`;
      body = html`<svg
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

    return html`<div class="rounded-[14px] border border-line bg-card p-[13px]">
      <div class="mb-2 flex items-baseline justify-between gap-2">
        <span class="text-[11px] font-medium text-muted">${name}</span>
        <span class="text-[15px] font-semibold text-ink">
          ${now != null ? fmtNum(this.hass, now, cfg.decimals) : "—"}<span
            class="ml-0.5 text-[11px] font-medium text-ink2"
            >${this._unit()}</span
          >
        </span>
      </div>
      ${body}
      ${
        cfg.show_stats && series && series.length >= 2
          ? html`<div
              class="mt-1.5 flex justify-between text-[9.5px] text-muted"
            >
              <span
                >min
                ${fmtNum(this.hass, Math.min(...series), cfg.decimals)}</span
              >
              <span
                >max
                ${fmtNum(this.hass, Math.max(...series), cfg.decimals)}</span
              >
            </div>`
          : ""
      }
    </div>`;
  }

  /** Masonry height in rows. */
  getCardSize() {
    return 2;
  }
  /** Legacy sections-view sizing (grid_columns/grid_rows). */
  getLayoutOptions() {
    return { grid_columns: 6, grid_rows: 2 };
  }
  /** Current sections-view sizing — half-width, auto height, min 3 columns. */
  getGridOptions() {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }
}
