/* ================================================================== *
 * CARD — fibbers-sysmon  (Lit + Tailwind)
 *
 * Host / Raspberry-Pi telemetry: a grid of metric tiles (cpu, temp, disk, ram,
 * uptime…) plus an optional history sparkline. Each metric reads an entity;
 * `graph` adds a sparkline over `graph_hours`.
 * ================================================================== */
import { LitElement, html, css } from "lit";
import { twSheet } from "../tw.js";
import "../icon.js";

const W = 300;
const nl = (n, d) =>
  Number.isFinite(n)
    ? n.toLocaleString(
        "nl-NL",
        d != null ? { minimumFractionDigits: d, maximumFractionDigits: d } : {},
      )
    : String(n);

export class FibbersSysmon extends LitElement {
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
  }

  updated(changed) {
    if (changed.has("hass") && this._config.graph) this._maybeFetch();
  }
  async _maybeFetch() {
    const id = this._config.graph;
    if (!this.hass || this._fetchedFor === id || !this.hass.callWS) return;
    this._fetchedFor = id;
    const hours = this._config.graph_hours || 24;
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
      const nums = ((res && res[id]) || [])
        .map((r) => Number(r.s != null ? r.s : r.state))
        .filter((n) => Number.isFinite(n));
      if (nums.length) this._series = nums;
    } catch (_e) {
      /* history unavailable */
    }
  }

  _val(m) {
    const st = this.hass && this.hass.states[m.entity];
    if (!st || st.state === "unavailable" || st.state === "unknown")
      return { text: "—", unit: "" };
    const unit =
      m.unit != null ? m.unit : st.attributes.unit_of_measurement || "";
    return { text: nl(Number(st.state), m.decimals) || st.state, unit };
  }

  _sparkline() {
    const series = this._series;
    if (!series || series.length < 2) return "";
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
}
