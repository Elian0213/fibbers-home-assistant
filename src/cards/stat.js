/* ================================================================== *
 * fibbers-stat — value tile: icon, label, value + unit, optional trend.
 * Reads `entity` or a literal `value`; tap runs `tap_action` (default more-info).
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { runAction } from "../actions.js";
import { twSheet } from "../tw.js";
import { fmtNum, fmtState, isUnavail, pickEntity } from "../util.js";
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

/** Locale-aware number formatting; leaves non-numeric states intact. */
const fmt = (hass, raw, decimals) => {
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? fmtNum(hass, n, decimals) : String(raw);
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

  static getStubConfig(hass, entities, entitiesFallback) {
    return {
      type: "custom:fibbers-stat",
      entity: pickEntity(
        "sensor",
        entities,
        entitiesFallback,
        "sensor.example",
      ),
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
    return isUnavail(this._st());
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
    // A literal `value` is kept verbatim through `fmt`. A timestamp entity renders
    // relative ("2 days ago", live-updating) so an absolute date can't overflow the
    // tile — `absolute_time: true` opts back into the full value. Numeric states go
    // through the locale-aware formatter; anything else (motion, enum) is handed to
    // HA's own localiser instead of printing the raw slug.
    const deviceClass = st && st.attributes && st.attributes.device_class;
    let value;
    let valueTpl = null;
    if (offline) value = "—";
    else if (cfg.value != null) value = fmt(this.hass, cfg.value, cfg.decimals);
    else if (
      deviceClass === "timestamp" &&
      !cfg.absolute_time &&
      !isNaN(Date.parse(st.state))
    ) {
      valueTpl = html`<ha-relative-time
        .hass=${this.hass}
        .datetime=${new Date(st.state)}
      ></ha-relative-time>`;
    } else {
      const n = Number(String(st.state).replace(",", "."));
      value = Number.isFinite(n)
        ? fmtNum(this.hass, n, cfg.decimals)
        : fmtState(this.hass, st);
    }
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
            >${valueTpl || value}</span
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
  getGridOptions() {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }
}
