/* ================================================================== *
 * fibbers-climate — thermostat: current temp + action, setpoint −/+, hvac-mode
 * chips (climate.set_temperature / set_hvac_mode).
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { t } from "@shared/i18n";
import { twSheet } from "@shared/tw";
import { pickEntity, isUnavail, clamp } from "@shared/util";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
  LovelaceCardConfig,
} from "@/types/home-assistant";
import "@shared/icon";

const MODE: Record<string, { icon: string; key: string }> = {
  heat: { icon: "solar:fire-bold-duotone", key: "mode_heat" },
  cool: { icon: "solar:snowflake-bold-duotone", key: "mode_cool" },
  fan_only: { icon: "solar:wind-bold-duotone", key: "mode_fan_only" },
  auto: { icon: "solar:temperature-bold-duotone", key: "mode_auto" },
  heat_cool: { icon: "solar:temperature-bold-duotone", key: "mode_auto" },
  dry: { icon: "solar:wind-bold-duotone", key: "mode_dry" },
  off: { icon: "solar:power-bold-duotone", key: "mode_off" },
};
const ACTION_KEY: Record<string, string> = {
  heating: "action_heating",
  cooling: "action_cooling",
  drying: "action_drying",
  fan: "action_fan",
  idle: "action_idle",
  off: "action_off",
};

/** YAML/editor config accepted by `fibbers-climate`. */
export interface ClimateConfig extends LovelaceCardConfig {
  entity: string;
  name?: string;
  language?: string;
}

/**
 * fibbers-climate — thermostat tile: current temp + hvac action, a setpoint −/+
 * stepper and hvac-mode chips (climate.set_temperature / set_hvac_mode).
 */
@customElement("fibbers-climate")
export class FibbersClimate extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config!: ClimateConfig;

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Card-picker stub: pick a real climate.* entity for the live preview. */
  static getStubConfig(
    _hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[],
  ): ClimateConfig {
    return {
      type: "custom:fibbers-climate",
      entity: pickEntity(
        "climate",
        entities,
        entitiesFallback,
        "climate.example",
      ),
    };
  }

  /** Validate + store the config; throws when `entity` isn't given (a climate.*). */
  setConfig(config: ClimateConfig): void {
    if (!config || !config.entity) {
      throw new Error("fibbers-climate: `entity` (a climate.*) is required");
    }
    this.config = config;
  }

  private _st(): HassEntity | undefined {
    return this.hass && this.hass.states[this.config.entity];
  }

  private _bump(delta: number): void {
    const st = this._st();
    if (!st || isUnavail(st) || !this.hass) return;
    const step = Number(st.attributes.target_temp_step) || 0.5;
    const cur = Number(st.attributes.temperature);
    if (!Number.isFinite(cur)) return; // heat_cool/range has no single setpoint
    const min = st.attributes.min_temp ?? 5;
    const max = st.attributes.max_temp ?? 35;
    // Snap onto the step grid (not a fixed 0.1) so 0.5-step and 1-step
    // thermostats both land on valid setpoints; toFixed kills float drift.
    const snapped = Math.round((cur + delta * step) / step) * step;
    const next = clamp(Number(snapped.toFixed(2)), min, max);
    this.hass.callService("climate", "set_temperature", {
      entity_id: this.config.entity,
      temperature: next,
    });
  }

  /** Current temp + action, the setpoint stepper (inert in range/unavailable) and the mode chips. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const st = this._st();
    if (!st)
      return html`<div
        class="rounded-[14px] border border-line bg-card p-[13px] text-[12px] text-muted"
      >
        ${t(hl, "common.not_available")}
      </div>`;
    const a = st.attributes;
    const unavail = isUnavail(st);
    const cur = a.current_temperature;
    const target = a.temperature;
    const low = a.target_temp_low;
    const high = a.target_temp_high;
    // heat_cool / range: no single `temperature`, so the −/+ can't act — show the
    // low–high band and disable the steppers.
    const range = target == null && (low != null || high != null);
    const canBump = !unavail && !range && target != null;
    const modes = ((a.hvac_modes as string[]) || []).filter((m) => MODE[m]);
    const action = a.hvac_action;

    return html`<div
      class="rounded-[14px] border border-line bg-card p-[13px] ${
        unavail ? "opacity-50" : ""
      }"
    >
      <div class="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <div
            class="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted"
          >
            ${cfg.name || a.friendly_name || t(hl, "climate.default_name")}
          </div>
          <div class="text-[24px] font-semibold leading-none text-ink">
            ${cur != null ? cur : "—"}<span class="text-[14px] text-ink2"
              >°</span
            >
          </div>
        </div>
        <span class="text-[11px] text-muted"
          >${ACTION_KEY[action] ? t(hl, `climate.${ACTION_KEY[action]}`) : t(hl, st.state !== "off" ? "climate.on" : "climate.off")}</span
        >
      </div>

      <div class="mb-3 flex items-center justify-center gap-4">
        <button
          type="button"
          aria-label="Lower setpoint"
          ?disabled=${!canBump}
          class="fib-hit flex h-10 w-10 items-center justify-center rounded-full bg-card2 text-ink
                 transition-transform active:scale-90
                 ${canBump ? "" : "pointer-events-none opacity-40"}"
          @click=${() => this._bump(-1)}
        >
          <fib-icon
            class="h-6 w-6 [--mdc-icon-size:24px]"
            icon="solar:minus-circle-bold-duotone"
          ></fib-icon>
        </button>
        <div class="min-w-[68px] text-center">
          <div class="text-[26px] font-semibold leading-none text-accent">
            ${
              // eslint-disable-next-line no-nested-ternary -- preserves the original range/target/fallback display
              range
                ? html`${low ?? "—"}–${high ?? "—"}`
                : target != null
                  ? target
                  : "—"
            }<span class="text-[14px]">°</span>
          </div>
          <div
            class="mt-0.5 text-[9.5px] uppercase tracking-[0.08em] text-muted"
          >
            ${t(hl, "climate.setpoint")}
          </div>
        </div>
        <button
          type="button"
          aria-label="Raise setpoint"
          ?disabled=${!canBump}
          class="fib-hit flex h-10 w-10 items-center justify-center rounded-full bg-card2 text-ink
                 transition-transform active:scale-90
                 ${canBump ? "" : "pointer-events-none opacity-40"}"
          @click=${() => this._bump(1)}
        >
          <fib-icon
            class="h-6 w-6 [--mdc-icon-size:24px]"
            icon="solar:add-circle-bold-duotone"
          ></fib-icon>
        </button>
      </div>

      ${
        modes.length
          ? html`<div class="flex flex-wrap justify-center gap-[7px]">
              ${modes.map((m) => {
                const active = st.state === m;
                return html`<button
                  type="button"
                  ?disabled=${unavail}
                  class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[5px]
                       text-[10.5px] font-medium ${
                         active
                           ? "border-accentline bg-accentbg text-accent"
                           : "border-line bg-card2 text-ink2"
                       } ${unavail ? "pointer-events-none opacity-40" : ""}"
                  @click=${() =>
                    this.hass &&
                    this.hass.callService("climate", "set_hvac_mode", {
                      entity_id: cfg.entity,
                      hvac_mode: m,
                    })}
                >
                  <fib-icon
                    class="h-[13px] w-[13px] [--mdc-icon-size:13px]"
                    icon=${MODE[m].icon}
                  ></fib-icon>
                  ${t(hl, `climate.${MODE[m].key}`)}
                </button>`;
              })}
            </div>`
          : ""
      }
    </div>`;
  }

  /** Masonry card-size (row) estimate. */
  getCardSize(): number {
    return 3;
  }

  /** Masonry layout hint — full width, 3 rows. */
  getLayoutOptions(): { grid_columns: string; grid_rows: number } {
    return { grid_columns: "full", grid_rows: 3 };
  }

  /** Sections-view grid hint — full width, auto rows. */
  getGridOptions(): { columns: string; rows: string } {
    return { columns: "full", rows: "auto" };
  }
}
