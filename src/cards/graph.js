/* ================================================================== *
 * CARD — fibbers-graph  (Lit + Tailwind)
 *
 * A single-entity sparkline: an SVG line/area of an entity's recent history,
 * with a header (name + current value) and optional min/max labels. History
 * comes from `history/history_during_period` over the last `hours`; a literal
 * `data: [numbers]` overrides the fetch.
 * ================================================================== */
import { LitElement, html, css } from "lit";
import { twSheet } from "../tw.js";

const COLORS = ["accent", "amber", "blue", "green", "red"];
/* full class strings so Tailwind's scanner emits every one (a dynamic
   `text-${color}` would purge the colours not used literally elsewhere). */
const STROKE = {
  accent: "text-accent",
  amber: "text-amber",
  blue: "text-blue",
  green: "text-green",
  red: "text-red",
};
const W = 300;
const nl = (n, d) =>
  Number.isFinite(n)
    ? n.toLocaleString(
        "nl-NL",
        d != null ? { minimumFractionDigits: d, maximumFractionDigits: d } : {},
      )
    : String(n);

export class FibbersGraph extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _series: { state: true },
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
      type: "custom:fibbers-graph",
      entity: "sensor.hue_motion_sensor_1_temperature",
      hours: 24,
    };
  }

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
    this._series = Array.isArray(config.data) ? config.data.map(Number) : null;
    this._fetchedFor = null;
  }

  updated(changed) {
    if (changed.has("hass") && this._config.entity && !this._config.data)
      this._maybeFetch();
  }

  async _maybeFetch() {
    const id = this._config.entity;
    if (!this.hass || this._fetchedFor === id || !this.hass.callWS) return;
    this._fetchedFor = id;
    const hours = this._config.hours || 24;
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600e3);
    try {
      const res = await this.hass.callWS({
        type: "history/history_during_period",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        entity_ids: [id],
        minimal_response: true,
        no_attributes: true,
      });
      const rows = (res && res[id]) || [];
      const nums = rows
        .map((r) => Number(r.s != null ? r.s : r.state))
        .filter((n) => Number.isFinite(n));
      if (nums.length) this._series = nums;
    } catch (_e) {
      /* history unavailable — the header still shows the live value */
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

  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const st = cfg.entity && this.hass && this.hass.states[cfg.entity];
    const name = cfg.name || (st && st.attributes.friendly_name) || cfg.entity;
    const now = this._current();
    const h = cfg.height || 46;
    const series = this._series;
    const color = cfg.color || "accent";
    const colorCls = STROKE[color] || "text-accent";

    let body;
    if (!series || series.length < 2) {
      body = html`<div
        class="flex items-center text-[11px] text-muted"
        style="height:${h}px"
      >
        Geen historie
      </div>`;
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
      const line = "M" + pts.join(" L");
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
          ${now != null ? nl(now, cfg.decimals) : "—"}<span
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
              <span>min ${nl(Math.min(...series), cfg.decimals)}</span>
              <span>max ${nl(Math.max(...series), cfg.decimals)}</span>
            </div>`
          : ""
      }
    </div>`;
  }

  getCardSize() {
    return 2;
  }
  getLayoutOptions() {
    return { grid_columns: 6, grid_rows: 2 };
  }
}
