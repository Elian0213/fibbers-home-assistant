/* ================================================================== *
 * fibbers-weather — current temp + condition and a short forecast strip from a
 * `weather.*` entity (reads its `forecast` attribute).
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t, langOf } from "../i18n.js";
import { twSheet } from "../tw.js";
import "../icon.js";

const COND_ICON = {
  "clear-night": "solar:moon-bold-duotone",
  sunny: "solar:sun-bold-duotone",
  partlycloudy: "solar:cloud-sun-bold-duotone",
  cloudy: "solar:cloud-bold-duotone",
  fog: "solar:cloud-bold-duotone",
  rainy: "solar:cloud-rain-bold-duotone",
  pouring: "solar:cloud-rain-bold-duotone",
  "lightning-rainy": "solar:cloud-rain-bold-duotone",
  lightning: "solar:cloud-rain-bold-duotone",
  snowy: "solar:cloud-bold-duotone",
  "snowy-rainy": "solar:cloud-rain-bold-duotone",
  hail: "solar:cloud-rain-bold-duotone",
  windy: "solar:cloud-bold-duotone",
  "windy-variant": "solar:cloud-bold-duotone",
  exceptional: "solar:cloud-bold-duotone",
};
const iconFor = (c) => COND_ICON[c] || "solar:cloud-bold-duotone";
const round = (n) =>
  Number.isFinite(Number(n)) ? Math.round(Number(n)) : null;
const dayNl = (iso, lang) => {
  const parsed = Date.parse(iso);
  if (isNaN(parsed)) return "";
  return new Date(parsed)
    .toLocaleDateString(lang || "en", { weekday: "short" })
    .replace(".", "");
};

export class FibbersWeather extends LitElement {
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
    return { type: "custom:fibbers-weather", entity: "weather.thuis" };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error(
        "fibbers-weather: `entity` (a weather.* entity) is required",
      );
    }
    this._config = config;
  }

  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const st = this.hass && this.hass.states[cfg.entity];
    if (!st)
      return html`<div
        class="rounded-[14px] border border-line bg-card p-[13px] text-[12px] text-muted"
      >
        ${t(hl, "common.not_available")}
      </div>`;

    const a = st.attributes || {};
    const days = (a.forecast || []).slice(0, cfg.days || 5);

    return html`<div class="rounded-[14px] border border-line bg-card p-[13px]">
      <div class="flex items-center gap-3">
        <div
          class="flex h-[42px] w-[42px] flex-none items-center justify-center"
        >
          <fib-icon
            class="h-[34px] w-[34px] [--mdc-icon-size:34px] text-accent"
            icon=${iconFor(st.state)}
          ></fib-icon>
        </div>
        <div>
          <div class="text-[26px] font-semibold leading-none text-ink">
            ${round(a.temperature) ?? "—"}<span
              class="text-[14px] font-medium text-ink2"
              >°</span
            >
          </div>
          <div class="text-[12px] text-ink2">
            ${COND_ICON[st.state] ? t(hl, `weather.conditions.${st.state}`) : st.state}
          </div>
        </div>
        <div class="ml-auto text-right">
          <span
            class="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted"
            >${cfg.name || a.friendly_name || t(hl, "weather.default_name")}</span
          >
        </div>
      </div>
      ${
        days.length
          ? html`<div class="mt-3 grid auto-cols-fr grid-flow-col gap-1">
              ${days.map(
                (f) =>
                  html`<div
                    class="flex flex-col items-center gap-1 rounded-[10px] bg-card2 px-0.5 py-2"
                  >
                    <span class="text-[10px] capitalize text-muted"
                      >${f.datetime ? dayNl(f.datetime, langOf(hl)) : ""}</span
                    >
                    <fib-icon
                      class="h-[18px] w-[18px] [--mdc-icon-size:18px] text-ink2"
                      icon=${iconFor(f.condition)}
                    ></fib-icon>
                    <span class="text-[11.5px] font-semibold text-ink"
                      >${
                        round(f.temperature) != null
                          ? `${round(f.temperature)}°`
                          : ""
                      }</span
                    >
                    <span class="text-[10px] text-muted"
                      >${
                        round(f.templow) != null ? `${round(f.templow)}°` : ""
                      }</span
                    >
                  </div>`,
              )}
            </div>`
          : ""
      }
    </div>`;
  }

  getCardSize() {
    return 2;
  }
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 2 };
  }
}
