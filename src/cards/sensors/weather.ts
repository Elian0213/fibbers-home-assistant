/* ================================================================== *
 * fibbers-weather — current temp + condition and a short forecast strip from a
 * `weather.*` entity. Subscribes to weather/subscribe_forecast (the `forecast`
 * state attribute was deprecated in 2023.9 and removed in HA 2024.4).
 * ================================================================== */
import {
  LitElement,
  html,
  css,
  type TemplateResult,
  type PropertyValues,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { t, langOf } from "@shared/i18n";
import { cardShell, unavailNotice } from "@shared/shells";
import { twSheet } from "@shared/tw";
import { pickEntity } from "@shared/util";
import { sectionLabel } from "@shared/variants";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
  LovelaceCardConfig,
} from "@/types/home-assistant";
import "@shared/icon";

/** A single daily forecast entry from the weather/subscribe_forecast feed. */
interface ForecastDay {
  datetime?: string;
  condition?: string;
  temperature?: number;
  templow?: number;
}

/** YAML/editor config accepted by `fibbers-weather`. */
export interface WeatherConfig extends LovelaceCardConfig {
  entity: string;
  name?: string;
  days?: number;
  language?: string;
}

const COND_ICON: Record<string, string> = {
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
/** Solar icon for an HA condition slug, with a cloud fallback for anything unmapped. */
const iconFor = (c: string | undefined): string =>
  COND_ICON[c as string] || "solar:cloud-bold-duotone";
/** Round to a whole number, or null for a non-numeric input (so callers can show "—"). */
const round = (n: unknown): number | null =>
  Number.isFinite(Number(n)) ? Math.round(Number(n)) : null;
/** Localised short weekday for a forecast datetime (trailing "." stripped); "" on a bad date. */
const dayNl = (iso: string, lang: string): string => {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed)
    .toLocaleDateString(lang || "en", { weekday: "short" })
    .replace(".", "");
};

/**
 * fibbers-weather — current temp + condition and a short forecast strip from a
 * `weather.*` entity. Subscribes to weather/subscribe_forecast (the `forecast`
 * state attribute was deprecated in 2023.9, removed in HA 2024.4).
 */
@customElement("fibbers-weather")
export class FibbersWeather extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config!: WeatherConfig;

  @state() private _forecast: ForecastDay[] | null = null;

  private _subFor?: string | null;

  private _unsubFn?: (() => void) | null;

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Seed config for the card picker — picks a real weather entity if one exists. */
  static getStubConfig(
    _hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[],
  ): WeatherConfig {
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

  /** Validate + store the config and clear any prior forecast; throws when the `weather.*` `entity` is missing so the editor surfaces it. */
  setConfig(config: WeatherConfig): void {
    if (!config || !config.entity) {
      throw new Error(
        "fibbers-weather: `entity` (a weather.* entity) is required",
      );
    }
    this.config = config;
    this._forecast = null;
  }

  /** On each hass push, (re)subscribe to the forecast feed for the current entity. */
  updated(changed: PropertyValues): void {
    if (changed.has("hass")) this._maybeSubscribe();
  }

  // Subscribe to the daily forecast push feed (what HA's own weather card uses);
  // re-subscribe on entity change, unsubscribe on disconnect.
  private _maybeSubscribe(): void {
    const id = this.config && this.config.entity;
    if (!id || this._subFor === id) return;
    const conn = this.hass && this.hass.connection;
    if (!conn || !conn.subscribeMessage) return;
    this._unsub();
    this._subFor = id;
    conn
      .subscribeMessage(
        (msg: { forecast?: ForecastDay[] } | undefined) => {
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

  private _unsub(): void {
    if (this._unsubFn) {
      this._unsubFn();
      this._unsubFn = null;
    }
  }

  /** Tear down the forecast subscription when the card leaves the DOM. */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsub();
    this._subFor = null;
  }

  // --- render helpers ------------------------------------------------

  private _renderCurrent(st: HassEntity, hl: unknown): TemplateResult {
    const cfg = this.config;
    const a = st.attributes || {};
    return html`<div class="flex items-center gap-3">
      <div class="flex h-[42px] w-[42px] flex-none items-center justify-center">
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
        <span class="${sectionLabel({ tracking: "tight" })}"
          >${cfg.name || a.friendly_name || t(hl, "weather.default_name")}</span
        >
      </div>
    </div>`;
  }

  private _renderForecast(
    days: ForecastDay[],
    hl: unknown,
  ): TemplateResult | string {
    if (!days.length) return "";
    return html`<div class="mt-3 grid auto-cols-fr grid-flow-col gap-1">
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
                round(f.temperature) != null ? `${round(f.temperature)}°` : ""
              }</span
            >
            <span class="text-[10px] text-muted"
              >${round(f.templow) != null ? `${round(f.templow)}°` : ""}</span
            >
          </div>`,
      )}
    </div>`;
  }

  /** Render current conditions plus the (up to `days`) forecast strip; a placeholder line until the entity exists. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const st = this.hass && this.hass.states[cfg.entity];
    if (!st) return unavailNotice(hl);

    const days = (this._forecast || []).slice(0, cfg.days || 5);
    return cardShell(
      html`${this._renderCurrent(st, hl)}${this._renderForecast(days, hl)}`,
    );
  }

  /** Masonry height in rows. */
  getCardSize(): number {
    return 2;
  }

  /** Legacy sections-view sizing (grid_columns/grid_rows). */
  getLayoutOptions(): { grid_columns: string; grid_rows: number } {
    return { grid_columns: "full", grid_rows: 2 };
  }

  /** Current sections-view sizing — full width, auto height. */
  getGridOptions(): { columns: string; rows: string } {
    return { columns: "full", rows: "auto" };
  }
}
