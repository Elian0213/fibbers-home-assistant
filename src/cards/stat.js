/* ================================================================== *
 * CARD — fibbers-stat  (Lit + Tailwind)
 *
 * One value tile: an icon box, a label, a big value + unit, and an optional
 * secondary line and trend arrow. The shared building block for sysmon /
 * climate / weather. Reads `entity` (state + unit + friendly_name) or takes a
 * literal `value`. Tapping runs `tap_action` (defaults to more-info).
 *
 * First card on the Lit + Tailwind stack: utilities come from the shared
 * adopted sheet (src/tw.js); box-shadow here exercises the @property hoist.
 * ================================================================== */
import { LitElement, html, css } from "lit";
import { twSheet } from "../tw.js";
import { runAction } from "../actions.js";
import "../icon.js"; // registers <fib-icon>

const COLORS = ["accent", "amber", "blue", "green", "red"];

/** icon-box background + foreground per colour (full strings so Tailwind sees them) */
const IC = {
  accent: "bg-accentbg text-accent",
  amber: "bg-amberbg text-amber",
  blue: "bg-bluebg text-blueink",
  green: "bg-accentbg text-green",
  red: "bg-amberbg text-red",
};

/** nl-NL number formatting; leaves non-numeric states intact. */
const fmt = (raw, decimals) => {
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return String(raw);
  const o =
    decimals != null
      ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
      : {};
  return n.toLocaleString("nl-NL", o);
};

export class FibbersStat extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
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
      type: "custom:fibbers-stat",
      entity: "sensor.hue_motion_sensor_1_temperature",
    };
  }

  setConfig(config) {
    if (!config || (!config.entity && config.value == null)) {
      throw new Error("fibbers-stat: `entity` or `value` is required");
    }
    if (config.color != null && !COLORS.includes(config.color)) {
      throw new Error(
        `fibbers-stat: \`color\` must be one of ${COLORS.join(", ")}`,
      );
    }
    this._config = config;
  }

  _st() {
    return this._config && this._config.entity && this.hass
      ? this.hass.states[this._config.entity]
      : null;
  }

  _offline() {
    if (!this._config.entity) return false;
    const st = this._st();
    return !st || st.state === "unavailable" || st.state === "unknown";
  }

  _tap() {
    const cfg = this._config;
    const tap = cfg.tap_action || (cfg.entity && { action: "more-info" });
    if (tap && tap.action !== "none")
      runAction(tap, this.hass, this, cfg.entity);
  }

  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const st = this._st();
    const offline = this._offline();
    const color = cfg.color || "accent";

    const icon =
      cfg.icon || (st && st.attributes.icon) || "solar:widget-bold-duotone";
    const label =
      cfg.name || (st && st.attributes.friendly_name) || cfg.entity || "";
    const value = offline
      ? "—"
      : fmt(cfg.value != null ? cfg.value : st.state, cfg.decimals);
    const unit = offline
      ? ""
      : cfg.unit != null
        ? cfg.unit
        : (st && st.attributes.unit_of_measurement) || "";
    const trend = ["up", "down", "flat"].includes(cfg.trend) ? cfg.trend : null;
    const trendChar = trend === "up" ? "▲" : trend === "down" ? "▼" : "—";
    const trendCls =
      trend === "up"
        ? "text-red"
        : trend === "down"
          ? "text-accent"
          : "text-muted";

    const tappable = cfg.tap_action || cfg.entity;

    return html`
      <div
        class="grid grid-cols-[34px_1fr] items-center gap-x-3 gap-y-0.5 rounded-[14px]
               border border-line bg-card p-3 shadow-[0_1px_3px_rgba(0,0,0,.35)]
               ${tappable ? "cursor-pointer" : ""}"
        role=${tappable ? "button" : "presentation"}
        @click=${() => tappable && this._tap()}
      >
        <div
          class="row-span-2 flex h-[34px] w-[34px] items-center justify-center rounded-[10px]
                 ${offline ? "bg-card2 text-muted" : IC[color]}"
        >
          <fib-icon
            class="h-[19px] w-[19px] [--mdc-icon-size:19px]"
            icon=${icon}
          ></fib-icon>
        </div>

        <div class="text-[11px] font-medium text-muted">${label}</div>

        <div class="flex items-baseline gap-[5px]">
          <span
            class="text-[22px] font-semibold leading-tight tracking-tight
                   ${offline ? "text-muted" : "text-ink"}"
            >${value}</span
          >
          <span class="text-[12px] font-medium text-ink2">${unit}</span>
          ${
            trend
              ? html`<span class="ml-0.5 text-[11px] font-semibold ${trendCls}"
                  >${trendChar}</span
                >`
              : ""
          }
        </div>

        ${
          cfg.sub
            ? html`<div class="col-start-2 text-[10.5px] text-muted">
                ${cfg.sub}
              </div>`
            : ""
        }
      </div>
    `;
  }

  getCardSize() {
    return 1;
  }

  getLayoutOptions() {
    return { grid_columns: 6, grid_rows: 1 };
  }
}
