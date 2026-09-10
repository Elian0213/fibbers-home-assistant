/* ================================================================== *
 * fibbers-weather-sheet — the body of the weather detail sheet (opened by
 * fibbers-weather via openModal, in the shared sheet chrome). Shows the current
 * conditions with feels-like / humidity / wind / pressure / sun times, an hourly
 * strip, and a multi-day list. Subscribes to weather/subscribe_forecast for both
 * the daily and hourly feeds. Not a picker card — defined here and imported for
 * its side effect from fibbers-weather.
 * ================================================================== */
import {
  LitElement,
  html,
  css,
  type TemplateResult,
  type PropertyValues,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";

import { t, langOf } from "@shared/i18n";
import { unavailNotice } from "@shared/shells";
import { twSheet } from "@shared/tw";
import { ThemeController } from "@shared/theme-host";
import { dragScroll } from "@shared/ui";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
} from "@/types/home-assistant";
import "@shared/icon";

import type { WeatherConfig } from "./weather";
import {
  COND_ICON,
  iconFor,
  round,
  dayName,
  hourLabel,
  type Forecast,
} from "./weather-util";

/**
 * fibbers-weather-sheet — the weather detail sheet body (current metrics + hourly
 * strip + multi-day list). Rendered inside the shared sheet by openModal.
 */
@customElement("fibbers-weather-sheet")
export class FibbersWeatherSheet extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  _theme = new ThemeController(this);

  @state() private config!: WeatherConfig;

  @state() private _daily: Forecast[] = [];

  @state() private _hourly: Forecast[] = [];

  private _subFor?: string | null;

  private _unsubs: (() => void)[] = [];

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
      /* Drag-scrollable hourly strip: no scrollbar, a grab cursor. */
      .hstrip {
        scrollbar-width: none;
        cursor: grab;
      }
      .hstrip::-webkit-scrollbar {
        display: none;
      }
    `,
  ];

  /** Store the config; throws when the `weather.*` `entity` is missing. */
  setConfig(config: WeatherConfig): void {
    if (!config || !config.entity) {
      throw new Error("fibbers-weather-sheet: `entity` is required");
    }
    this.config = config;
  }

  /** On each hass push, (re)subscribe to the daily + hourly forecast feeds. */
  updated(changed: PropertyValues): void {
    if (changed.has("hass")) this._maybeSubscribe();
  }

  private _maybeSubscribe(): void {
    const id = this.config && this.config.entity;
    if (!id || this._subFor === id) return;
    const conn = this.hass && this.hass.connection;
    if (!conn || !conn.subscribeMessage) return;
    this._unsubAll();
    this._subFor = id;
    this._subscribe(conn, id, "daily", (f) => {
      this._daily = f;
    });
    this._subscribe(conn, id, "hourly", (f) => {
      this._hourly = f;
    });
  }

  private _subscribe(
    conn: NonNullable<HomeAssistant["connection"]>,
    id: string,
    forecastType: "daily" | "hourly",
    apply: (f: Forecast[]) => void,
  ): void {
    conn
      .subscribeMessage(
        (msg: { forecast?: Forecast[] } | undefined) =>
          apply((msg && msg.forecast) || []),
        {
          type: "weather/subscribe_forecast",
          entity_id: id,
          forecast_type: forecastType,
        },
      )
      .then((unsub) => {
        if (!this.isConnected || this._subFor !== id) {
          unsub();
          return;
        }
        this._unsubs.push(unsub);
      })
      .catch(() => {});
  }

  private _unsubAll(): void {
    this._unsubs.forEach((u) => u());
    this._unsubs = [];
  }

  /** Tear down the forecast subscriptions when the sheet closes. */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubAll();
    this._subFor = null;
  }

  // --- render helpers ------------------------------------------------

  private _metric(label: string, value: string): TemplateResult {
    return html`<div class="rounded-[12px] bg-card2 px-3 py-2">
      <div class="text-[10px] uppercase tracking-[0.06em] text-muted">
        ${label}
      </div>
      <div class="text-[15px] font-semibold text-ink">${value}</div>
    </div>`;
  }

  private _metrics(
    a: HassEntity["attributes"],
    hl: unknown,
    lang: string,
  ): TemplateResult[] {
    const out: TemplateResult[] = [];
    const add = (label: string, value: string | number | null | undefined) => {
      if (value != null && value !== "")
        out.push(this._metric(label, String(value)));
    };
    if (a.apparent_temperature != null)
      add(t(hl, "weather.feels_like"), `${round(a.apparent_temperature)}°`);
    if (a.humidity != null)
      add(t(hl, "weather.humidity"), `${round(a.humidity)}%`);
    if (a.wind_speed != null)
      add(
        t(hl, "weather.wind"),
        `${round(a.wind_speed)} ${a.wind_speed_unit || "km/h"}`,
      );
    if (a.pressure != null)
      add(
        t(hl, "weather.pressure"),
        `${round(a.pressure)} ${a.pressure_unit || "hPa"}`,
      );
    const sun = this.hass && this.hass.states["sun.sun"];
    if (sun) {
      add(
        t(hl, "weather.sunrise"),
        hourLabel(sun.attributes.next_rising, lang),
      );
      add(
        t(hl, "weather.sunset"),
        hourLabel(sun.attributes.next_setting, lang),
      );
    }
    return out;
  }

  private _renderCurrent(
    st: HassEntity,
    a: HassEntity["attributes"],
    hl: unknown,
  ): TemplateResult {
    return html`<div class="flex items-center gap-4">
      <fib-icon
        class="h-14 w-14 [--mdc-icon-size:56px] text-accent"
        icon=${iconFor(st.state)}
      ></fib-icon>
      <div>
        <div class="text-[40px] font-semibold leading-none text-ink">
          ${round(a.temperature) ?? "—"}<span class="text-[18px] text-ink2"
            >°</span
          >
        </div>
        <div class="text-[13px] text-ink2">
          ${
            COND_ICON[st.state]
              ? t(hl, `weather.conditions.${st.state}`)
              : st.state
          }
        </div>
      </div>
    </div>`;
  }

  private _sectionLabel(text: string): TemplateResult {
    return html`<div
      class="mb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted"
    >
      ${text}
    </div>`;
  }

  private _renderHourly(
    hours: Forecast[],
    hl: unknown,
    lang: string,
  ): TemplateResult {
    return html`<div>
      ${this._sectionLabel(t(hl, "weather.hourly"))}
      <div
        class="hstrip flex gap-2 overflow-x-auto pb-1"
        ${ref((el) => el && dragScroll(el as HTMLElement))}
      >
        ${hours.map(
          (f) =>
            html`<div
              class="flex w-14 flex-none flex-col items-center gap-1 rounded-[12px] bg-card2 py-2"
            >
              <span class="text-[10px] text-muted"
                >${f.datetime ? hourLabel(f.datetime, lang) : ""}</span
              >
              <fib-icon
                class="h-[18px] w-[18px] [--mdc-icon-size:18px] text-ink2"
                icon=${iconFor(f.condition)}
              ></fib-icon>
              <span class="text-[12px] font-semibold text-ink"
                >${round(f.temperature) != null ? `${round(f.temperature)}°` : ""}</span
              >
            </div>`,
        )}
      </div>
    </div>`;
  }

  private _renderDaily(
    days: Forecast[],
    hl: unknown,
    lang: string,
  ): TemplateResult {
    return html`<div>
      ${this._sectionLabel(t(hl, "weather.daily"))}
      <div class="flex flex-col">
        ${days.map(
          (f) =>
            html`<div
              class="flex items-center gap-3 border-t border-line py-2 first:border-t-0"
            >
              <span class="w-12 text-[13px] font-medium capitalize text-ink"
                >${f.datetime ? dayName(f.datetime, lang) : ""}</span
              >
              <fib-icon
                class="h-[20px] w-[20px] [--mdc-icon-size:20px] text-ink2"
                icon=${iconFor(f.condition)}
              ></fib-icon>
              <span class="ml-auto text-[13px] text-ink">
                <span class="font-semibold"
                  >${round(f.temperature) != null ? `${round(f.temperature)}°` : "—"}</span
                ><span class="text-muted">
                  /
                  ${round(f.templow) != null ? `${round(f.templow)}°` : "—"}</span
                >
              </span>
            </div>`,
        )}
      </div>
    </div>`;
  }

  /** The full detail view: current + metrics + hourly strip + multi-day list. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const lang = langOf(hl);
    const st = this.hass && this.hass.states[cfg.entity];
    if (!st) return unavailNotice(hl);
    const a = st.attributes || {};
    const metrics = this._metrics(a, hl, lang);
    const hourly = this._hourly.slice(0, 24);
    const daily = this._daily.slice(0, 7);
    return html`<div class="flex flex-col gap-4">
      ${this._renderCurrent(st, a, hl)}
      ${
        metrics.length
          ? html`<div class="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
              ${metrics}
            </div>`
          : ""
      }
      ${hourly.length ? this._renderHourly(hourly, hl, lang) : ""}
      ${daily.length ? this._renderDaily(daily, hl, lang) : ""}
    </div>`;
  }

  /** Sheet body — nominal size (it's rendered in the modal, not the grid). */
  getCardSize(): number {
    return 6;
  }
}
