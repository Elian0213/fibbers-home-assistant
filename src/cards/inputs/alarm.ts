/* ================================================================== *
 * fibbers-alarm — the wake-up alarm as one tile: time, next occurrence, fade
 * start, light + radio summaries, last-run status, and a master on/off toggle.
 * Tapping anywhere but the toggle opens the alarm sheet (fibbers-alarm-sheet) in
 * the shared sheet chrome. Supersedes the scheduler + datetime pair on the Huis
 * tab; reads/writes only the existing input_* helpers.
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { openModal } from "@core/body-sheet";
import { t } from "@shared/i18n";
import { dayModeToWeekdays, nextAlarm } from "@shared/next-occurrence";
import { twSheet } from "@shared/tw";
import { ThemeController } from "@shared/theme-host";
import { pillSwitch } from "@shared/ui";
import { isUnavail, pickEntity } from "@shared/util";
import { cx } from "@shared/variants";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
} from "@/types/home-assistant";
import {
  assertAlarmConfig,
  hhmm,
  type AlarmConfig,
} from "@cards/inputs/alarm-config";
import "@cards/inputs/alarm-sheet"; // registers <fibbers-alarm-sheet> for the modal
import "@shared/icon";

/** The HA entity registry, narrowed to the labels we read for `lights_label`. */
interface HassWithEntities {
  entities?: Record<string, { labels?: string[] }>;
}

const shortWeekday = (d: Date, lang: string): string =>
  d.toLocaleDateString(lang || "en", { weekday: "short" }).replace(".", "");

/**
 * fibbers-alarm — the whole wake-up alarm on one tile, with a master toggle and a
 * tap-through to the settings sheet.
 */
@customElement("fibbers-alarm")
export class FibbersAlarm extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  _theme = new ThemeController(this);

  @state() private config!: AlarmConfig;

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Seed config — an input_datetime time + input_boolean enable, or placeholders. */
  static getStubConfig(
    _hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[],
  ): AlarmConfig {
    return {
      type: "custom:fibbers-alarm",
      name: "Alarm",
      icon: "solar:alarm-bold-duotone",
      time: pickEntity(
        "input_datetime",
        entities,
        entitiesFallback,
        "input_datetime.example",
      ),
      enable: pickEntity(
        "input_boolean",
        entities,
        entitiesFallback,
        "input_boolean.example",
      ),
    };
  }

  /** Validate + store the config (throws on missing `time` / lights conflict). */
  setConfig(config: AlarmConfig): void {
    assertAlarmConfig(config, "fibbers-alarm");
    this.config = config;
  }

  // --- entity helpers ----------------------------------------------------------

  private _st(id: string | undefined): HassEntity | null {
    return id && this.hass ? this.hass.states[id] : null;
  }

  private get _lang(): string {
    return (
      this.config.language ||
      (this.hass &&
        ((this.hass.locale && this.hass.locale.language) ||
          this.hass.language)) ||
      "en"
    );
  }

  // Wake lights: explicit `lights`, else resolved from `lights_label` via the
  // entity registry. null = undeterminable (label given but the registry/labels
  // aren't exposed) — the caller must not raise a false "no lamp" warning then.
  private _wakeLights(): string[] | null {
    const cfg = this.config;
    if (Array.isArray(cfg.lights)) return cfg.lights;
    if (!cfg.lights_label) return null;
    const label = cfg.lights_label;
    const reg = this.hass as unknown as HassWithEntities | undefined;
    const ents = reg && reg.entities;
    if (!ents) return null; // labels not exposed on this HA — can't tell
    return Object.keys(ents).filter((id) => {
      const { labels } = ents[id];
      return (
        id.startsWith("light.") &&
        Array.isArray(labels) &&
        labels.includes(label)
      );
    });
  }

  // The one state that makes the alarm silently fail: a configured wake-light set
  // that resolves to nothing, or one whose lamps are all unreachable.
  private _noReachableLight(): boolean {
    const ids = this._wakeLights();
    if (ids == null) return false; // undeterminable → don't cry wolf
    if (ids.length === 0) return !!this.config.lights_label;
    return ids.every((id) => isUnavail(this._st(id)));
  }

  private _open(): void {
    if (!this.hass) return;
    const cfg = this.config;
    openModal({
      title: cfg.name || t(cfg.language || this.hass, "alarm.title"),
      icon: cfg.icon || "solar:alarm-bold-duotone",
      // Spread config first so `type` wins — the sheet is its own element.
      cards: [{ ...cfg, type: "custom:fibbers-alarm-sheet" }],
      hass: this.hass,
      entityId: cfg.enable || cfg.time,
      wide: false,
    });
  }

  // --- derived copy ------------------------------------------------------------

  // "vandaag" / "morgen" / a short weekday, or "Uit" when the alarm is disarmed.
  private _nextText(on: boolean): string {
    const hl = this.config.language || this.hass;
    if (!on) return t(hl, "alarm.off");
    const time = hhmm(this._st(this.config.time)?.state);
    const daysSt = this._st(this.config.days);
    const na = nextAlarm(
      new Date(),
      time,
      dayModeToWeekdays(daysSt ? daysSt.state : null),
    );
    if (na.when === "today") return t(hl, "alarm.today");
    if (na.when === "tomorrow") return t(hl, "alarm.tomorrow");
    if (na.when === "later" && na.date)
      return shortWeekday(na.date, this._lang);
    return "—";
  }

  // "20 min → 100%" from duration + brightness (either alone is fine), or "".
  private _lightSummary(): string {
    const dur = Number(this._st(this.config.duration)?.state);
    const bri = Number(this._st(this.config.brightness)?.state);
    const parts: string[] = [];
    if (Number.isFinite(dur)) parts.push(`${dur} min`);
    if (Number.isFinite(bri)) parts.push(`→ ${bri}%`);
    return parts.join(" ");
  }

  // "IE · SPIN 1038 · 15%" / "Radio uit" / "" (no radio entities configured).
  private _radioSummary(): { text: string; off: boolean } | null {
    const cfg = this.config;
    if (!cfg.radio_enable && !cfg.station && !cfg.volume) return null;
    const on = cfg.radio_enable
      ? this._st(cfg.radio_enable)?.state === "on"
      : true;
    if (!on)
      return {
        text: t(cfg.language || this.hass, "alarm.radio_off"),
        off: true,
      };
    const parts: string[] = [];
    const station = this._st(cfg.station)?.state;
    if (station && !isUnavail(this._st(cfg.station))) parts.push(station);
    const vol = Number(this._st(cfg.volume)?.state);
    if (Number.isFinite(vol)) parts.push(`${vol}%`);
    return { text: parts.join(" · "), off: false };
  }

  // --- render ------------------------------------------------------------------

  // The light slot: a warning when no wake lamp is reachable, else the fade
  // summary, else nothing.
  private _renderLightBit(
    hl: unknown,
    noLight: boolean,
    light: string,
  ): TemplateResult | string {
    if (noLight)
      return html`<span class="flex items-center gap-1 font-medium text-amber">
        <fib-icon
          class="h-3.5 w-3.5 [--mdc-icon-size:14px]"
          icon="solar:danger-triangle-bold-duotone"
        ></fib-icon>
        ${t(hl, "alarm.no_light")}
      </span>`;
    if (!light) return "";
    return html`<span class="flex items-center gap-1.5 text-ink2">
      <fib-icon
        class="h-3.5 w-3.5 text-muted [--mdc-icon-size:14px]"
        icon="solar:sunrise-bold-duotone"
      ></fib-icon>
      ${light}
    </span>`;
  }

  /** Draw the tile: header + toggle, big time + day mode, next-occurrence,
   * light/radio summaries and the status line. Tap-through opens the sheet. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const enSt = this._st(cfg.enable);
    const on = enSt ? enSt.state === "on" : true;
    const name = cfg.name || t(hl, "alarm.title");
    const icon = cfg.icon || "solar:alarm-bold-duotone";
    const time = hhmm(this._st(cfg.time)?.state) || "—";
    const daysSt = this._st(cfg.days);
    const dayMode = daysSt ? daysSt.state : "";
    const fadeStart = hhmm(this._st(cfg.light_start)?.state);
    const noLight = this._noReachableLight();
    const light = this._lightSummary();
    const radio = this._radioSummary();
    const statusSt = this._st(cfg.status);
    const status =
      statusSt && !isUnavail(statusSt) && statusSt.state ? statusSt.state : "";
    const statusWarn = status.startsWith("FOUT");

    return html`<div
      class="${cx(
        "relative rounded-[15px] border p-[13px]",
        on && !noLight ? "fib-lit" : "border-line bg-card",
        !on && "opacity-[.66]",
      )}"
    >
      <button
        type="button"
        class="absolute inset-0 cursor-pointer rounded-[15px] transition-colors hover:bg-white/[.04]"
        aria-label=${`${name} ${time} — ${this._nextText(on)}`}
        @click=${() => this._open()}
      ></button>

      <div class="pointer-events-none relative flex flex-col gap-2">
        <!-- header: icon · title · master toggle -->
        <div class="flex items-center gap-2.5">
          <fib-icon
            class="${cx(
              "h-[18px] w-[18px] flex-none [--mdc-icon-size:18px]",
              on ? "text-accent" : "text-muted",
            )}"
            icon=${icon}
          ></fib-icon>
          <span class="flex-1 truncate text-[13px] font-semibold text-ink"
            >${name}</span
          >
          ${
            cfg.enable
              ? html`<span class="pointer-events-auto flex items-center">
                  ${pillSwitch({
                    on,
                    label: t(hl, "alarm.alarm_on"),
                    onClick: () =>
                      this.hass &&
                      this.hass.callService("homeassistant", "toggle", {
                        entity_id: cfg.enable,
                      }),
                  })}
                </span>`
              : ""
          }
        </div>

        <!-- time + day mode -->
        <div class="flex items-end justify-between gap-3">
          <span
            class="text-[34px] font-semibold leading-none tabular-nums text-ink"
            >${time}</span
          >
          ${
            dayMode
              ? html`<span
                  class="${cx(
                    "rounded-full border border-line bg-card2 px-2.5 py-1 text-[10.5px] font-medium",
                    on ? "text-ink2" : "text-muted",
                  )}"
                  >${dayMode}</span
                >`
              : ""
          }
        </div>

        <!-- next occurrence · fade start -->
        <div class="text-[11.5px] text-muted">
          ${this._nextText(on)}${
            fadeStart
              ? html` · ${t(hl, "alarm.light_from", { time: fadeStart })}`
              : ""
          }
        </div>

        <!-- divider -->
        <div class="my-0.5 h-px bg-line"></div>

        <!-- light + radio summaries -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]">
          ${this._renderLightBit(hl, noLight, light)}
          ${
            radio
              ? html`<span
                  class="${cx(
                    "flex items-center gap-1.5",
                    radio.off ? "text-muted" : "text-ink2",
                  )}"
                >
                  <fib-icon
                    class="h-3.5 w-3.5 text-muted [--mdc-icon-size:14px]"
                    icon="solar:soundwave-bold-duotone"
                  ></fib-icon>
                  ${radio.text}
                </span>`
              : ""
          }
        </div>

        <!-- status -->
        ${
          status
            ? html`<div
                class="${cx(
                  "truncate font-mono text-[10.5px]",
                  statusWarn ? "text-amber" : "text-muted",
                )}"
                title=${status}
              >
                ${status}
              </div>`
            : ""
        }
      </div>
    </div>`;
  }

  /** Masonry hint — a tall tile (time + summaries + status). */
  getCardSize(): number {
    return 4;
  }

  /** Sections view: full width, ~4 rows. */
  getLayoutOptions(): { grid_columns: string; grid_rows: number } {
    return { grid_columns: "full", grid_rows: 4 };
  }

  /** Grid layout: min 6 columns, auto height. */
  getGridOptions(): { columns: number; rows: string } {
    return { columns: 6, rows: "auto" };
  }
}
