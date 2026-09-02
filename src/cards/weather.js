/* ================================================================== *
 * fibbers-weather — current temp + condition and a short forecast strip from a
 * `weather.*` entity. Subscribes to weather/subscribe_forecast (the `forecast`
 * state attribute was deprecated in 2023.9 and removed in HA 2024.4).
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t, langOf } from "../i18n.js";
import { twSheet } from "../tw.js";
import { pickEntity } from "../util.js";
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
    _forecast: { state: true },
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
      type: "custom:fibbers-weather",
      entity: pickEntity(
        "weather",
        entities,
        entitiesFallback,
        "weather.example",
      ),
    };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error(
        "fibbers-weather: `entity` (a weather.* entity) is required",
      );
    }
    this._config = config;
    this._forecast = null;
  }

  updated(changed) {
    if (changed.has("hass")) this._maybeSubscribe();
  }

  // Subscribe to the daily forecast push feed (what HA's own weather card uses);
  // re-subscribe on entity change, unsubscribe on disconnect.
  _maybeSubscribe() {
    const id = this._config && this._config.entity;
    if (!id || this._subFor === id) return;
    const conn = this.hass && this.hass.connection;
    if (!conn || !conn.subscribeMessage) return;
    this._unsub();
    this._subFor = id;
    conn
      .subscribeMessage(
        (msg) => {
          this._forecast = (msg && msg.forecast) || [];
        },
        {
          type: "weather/subscribe_forecast",
          entity_id: id,
          forecast_type: "daily",
        },
      )
      .then((unsub) => {
        // Disconnected (or re-subscribed to another entity) before this resolved —
        // drop the now-orphaned subscription instead of storing an unsub nobody
        // will ever call.
        if (!this.isConnected || this._subFor !== id) {
          unsub();
          return;
        }
        this._unsubFn = unsub;
      })
      .catch(() => {
        this._subFor = null; // let a later hass update retry
      });
  }
  _unsub() {
    if (this._unsubFn) {
      this._unsubFn();
      this._unsubFn = null;
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub();
    this._subFor = null;
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
    const days = (this._forecast || []).slice(0, cfg.days || 5);

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
  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }
}
