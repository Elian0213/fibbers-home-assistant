/* ================================================================== *
 * fibbers-climate — thermostat: current temp + action, setpoint −/+, hvac-mode
 * chips (climate.set_temperature / set_hvac_mode).
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t } from "../i18n.js";
import { twSheet } from "../tw.js";
import { pickEntity } from "../util.js";
import "../icon.js";

const MODE = {
  heat: { icon: "solar:fire-bold-duotone", key: "mode_heat" },
  cool: { icon: "solar:snowflake-bold-duotone", key: "mode_cool" },
  fan_only: { icon: "solar:wind-bold-duotone", key: "mode_fan_only" },
  auto: { icon: "solar:temperature-bold-duotone", key: "mode_auto" },
  heat_cool: { icon: "solar:temperature-bold-duotone", key: "mode_auto" },
  dry: { icon: "solar:wind-bold-duotone", key: "mode_dry" },
  off: { icon: "solar:power-bold-duotone", key: "mode_off" },
};
const ACTION_KEY = {
  heating: "action_heating",
  cooling: "action_cooling",
  drying: "action_drying",
  fan: "action_fan",
  idle: "action_idle",
  off: "action_off",
};

export class FibbersClimate extends LitElement {
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
      type: "custom:fibbers-climate",
      entity: pickEntity(
        "climate",
        entities,
        entitiesFallback,
        "climate.example",
      ),
    };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("fibbers-climate: `entity` (a climate.*) is required");
    }
    this._config = config;
  }

  _st() {
    return this.hass && this.hass.states[this._config.entity];
  }

  _bump(delta) {
    const st = this._st();
    if (!st) return;
    const step = st.attributes.target_temp_step || 0.5;
    const cur = Number(st.attributes.temperature);
    if (!Number.isFinite(cur)) return;
    const min = st.attributes.min_temp ?? 5;
    const max = st.attributes.max_temp ?? 35;
    const next = Math.min(
      max,
      Math.max(min, Math.round((cur + delta * step) * 10) / 10),
    );
    this.hass.callService("climate", "set_temperature", {
      entity_id: this._config.entity,
      temperature: next,
    });
  }

  render() {
    const cfg = this._config;
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
    const cur = a.current_temperature;
    const target = a.temperature;
    const modes = (a.hvac_modes || []).filter((m) => MODE[m]);
    const action = a.hvac_action;

    return html`<div class="rounded-[14px] border border-line bg-card p-[13px]">
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
          class="flex h-10 w-10 items-center justify-center rounded-full bg-card2 text-ink
                 transition-transform active:scale-90"
          @click=${() => this._bump(-1)}
        >
          <fib-icon
            class="h-6 w-6 [--mdc-icon-size:24px]"
            icon="solar:minus-circle-bold-duotone"
          ></fib-icon>
        </button>
        <div class="min-w-[68px] text-center">
          <div class="text-[26px] font-semibold leading-none text-accent">
            ${target != null ? target : "—"}<span class="text-[14px]">°</span>
          </div>
          <div
            class="mt-0.5 text-[9.5px] uppercase tracking-[0.08em] text-muted"
          >
            ${t(hl, "climate.setpoint")}
          </div>
        </div>
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-full bg-card2 text-ink
                 transition-transform active:scale-90"
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
                  class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[5px]
                       text-[10.5px] font-medium ${
                         active
                           ? "border-accentline bg-accentbg text-accent"
                           : "border-line bg-card2 text-ink2"
                       }"
                  @click=${() =>
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

  getCardSize() {
    return 3;
  }
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 3 };
  }
  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }
}
