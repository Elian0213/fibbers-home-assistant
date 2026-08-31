/* ================================================================== *
 * CARD — fibbers-climate  (Lit + Tailwind)
 *
 * A thermostat tile: current temperature + hvac action, a setpoint with −/+
 * (climate.set_temperature), and hvac-mode chips (climate.set_hvac_mode).
 * ================================================================== */
import { LitElement, html, css } from "lit";
import { twSheet } from "../tw.js";
import "../icon.js";

const MODE = {
  heat: { icon: "solar:fire-bold-duotone", label: "Verwarmen" },
  cool: { icon: "solar:snowflake-bold-duotone", label: "Koelen" },
  fan_only: { icon: "solar:wind-bold-duotone", label: "Ventilator" },
  auto: { icon: "solar:temperature-bold-duotone", label: "Auto" },
  heat_cool: { icon: "solar:temperature-bold-duotone", label: "Auto" },
  dry: { icon: "solar:wind-bold-duotone", label: "Drogen" },
  off: { icon: "solar:power-bold-duotone", label: "Uit" },
};
const ACTION_NL = {
  heating: "Verwarmt",
  cooling: "Koelt",
  drying: "Droogt",
  fan: "Ventileert",
  idle: "Inactief",
  off: "Uit",
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

  static getStubConfig() {
    return { type: "custom:fibbers-climate", entity: "climate.woonkamer" };
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
    const st = this._st();
    if (!st)
      return html`<div
        class="rounded-[14px] border border-line bg-card p-[13px] text-[12px] text-muted"
      >
        Niet beschikbaar
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
            ${cfg.name || a.friendly_name || "Thermostaat"}
          </div>
          <div class="text-[24px] font-semibold leading-none text-ink">
            ${cur != null ? cur : "—"}<span class="text-[14px] text-ink2"
              >°</span
            >
          </div>
        </div>
        <span class="text-[11px] text-muted"
          >${ACTION_NL[action] || (st.state !== "off" ? "Aan" : "Uit")}</span
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
            Ingesteld
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
                  ${MODE[m].label}
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
}
