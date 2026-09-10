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
import { ThemeController } from "@shared/theme-host";
import { pickEntity } from "@shared/util";
import { pressable, sectionLabel } from "@shared/variants";

import { openModal } from "@core/body-sheet";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
} from "@/types/home-assistant";
import "@shared/icon";

import {
  COND_ICON,
  iconFor,
  round,
  dayName,
  type Forecast,
} from "./weather-util";
import "@cards/sensors/weather-sheet"; // registers <fibbers-weather-sheet> for the modal

/** YAML/editor config accepted by `fibbers-weather`. */
export interface WeatherConfig extends LovelaceCardConfig {
  entity: string;
  name?: string;
  days?: number;
  language?: string;
}

// ha-form schema for the visual editor. Unlisted keys (language) pass through
// untouched — a YAML config round-trips.
const EDITOR_SCHEMA = [
  {
    name: "entity",
    selector: { entity: { domain: "weather" } },
    required: true,
  },
  { name: "name", selector: { text: {} } },
  { name: "days", selector: { number: { min: 1, max: 10, mode: "box" } } },
];

/**
 * fibbers-weather — current temp + condition and a short forecast strip from a
 * `weather.*` entity. Subscribes to weather/subscribe_forecast (the `forecast`
 * state attribute was deprecated in 2023.9, removed in HA 2024.4).
 */
@customElement("fibbers-weather")
export class FibbersWeather extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  _theme = new ThemeController(this);

  @state() private config!: WeatherConfig;

  @state() private _forecast: Forecast[] | null = null;

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

  /** Visual editor element, wired to EDITOR_SCHEMA. */
  static getConfigElement(): LovelaceCardEditor {
    const el = document.createElement(
      "fibbers-form-editor",
    ) as LovelaceCardEditor & {
      schema?: unknown;
    };
    el.schema = EDITOR_SCHEMA;
    return el;
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
        (msg: { forecast?: Forecast[] } | undefined) => {
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

  /** Open the rich weather detail sheet (hourly + multi-day + current metrics). */
  private _open(): void {
    if (!this.hass) return;
    const cfg = this.config;
    const st = this.hass.states[cfg.entity];
    const name =
      cfg.name ||
      (st && st.attributes.friendly_name) ||
      t(cfg.language || this.hass, "weather.default_name");
    openModal({
      title: name,
      icon: iconFor(st && st.state),
      cards: [{ ...cfg, type: "custom:fibbers-weather-sheet" }],
      hass: this.hass,
      entityId: cfg.entity,
      wide: false,
    });
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
    days: Forecast[],
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
              >${f.datetime ? dayName(f.datetime, langOf(hl)) : ""}</span
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
      html`<button
        type="button"
        class="block w-full text-left ${pressable({ hover: "tint" })}"
        aria-label=${
          cfg.name ||
          st.attributes.friendly_name ||
          t(hl, "weather.default_name")
        }
        @click=${() => this._open()}
      >
        ${this._renderCurrent(st, hl)}${this._renderForecast(days, hl)}
      </button>`,
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
