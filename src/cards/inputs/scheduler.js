/* ================================================================== *
 * fibbers-scheduler — wake control over input_datetime/boolean/number helpers:
 * big time (tap → more-info), enable toggle, fade window, weekday chips.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t } from "../../shared/i18n.js";
import { twSheet } from "../../shared/tw.js";
import { pillSwitch } from "../../shared/ui.js";
import { moreInfo, pickEntity } from "../../shared/util.js";
import "../../shared/icon.js";

// Only a real HH:MM prefix — so "unavailable"/"unknown" renders as "—" instead
// of a garbage "unava" big-time.
const hhmm = (s) => {
  const m = typeof s === "string" && s.match(/^(\d{2}:\d{2})/);
  return m ? m[1] : "";
};
const addMinutes = (s, mins) => {
  const [h, m] = hhmm(s).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const total = (h * 60 + m + Math.round(mins)) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export class FibbersScheduler extends LitElement {
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
      type: "custom:fibbers-scheduler",
      name: "Alarm",
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

  setConfig(config) {
    if (!config || !config.time) {
      throw new Error(
        "fibbers-scheduler: `time` (an input_datetime) is required",
      );
    }
    this._config = config;
  }

  _state(id) {
    return id && this.hass ? this.hass.states[id] : null;
  }

  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const timeSt = this._state(cfg.time);
    const time = hhmm(timeSt && timeSt.state);
    const enSt = this._state(cfg.enable);
    const on = enSt ? enSt.state === "on" : true;
    const durSt = this._state(cfg.duration);
    const dur = durSt ? Number(durSt.state) : null;
    const windowEnd = dur ? addMinutes(time, dur) : "";

    return html`<div class="rounded-[14px] border border-line bg-card p-[13px]">
      <div class="mb-2 flex items-center gap-2">
        <fib-icon
          class="h-4 w-4 [--mdc-icon-size:16px] ${on ? "text-accent" : "text-muted"}"
          icon="solar:alarm-bold-duotone"
        ></fib-icon>
        <span
          class="flex-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
          >${cfg.name || t(hl, "scheduler.default_name")}</span
        >
        ${
          cfg.enable
            ? pillSwitch({
                on,
                label: cfg.name || t(hl, "scheduler.default_name"),
                onClick: () =>
                  this.hass &&
                  this.hass.callService("homeassistant", "toggle", {
                    entity_id: cfg.enable,
                  }),
              })
            : ""
        }
      </div>

      <button
        type="button"
        class="text-left ${on ? "" : "opacity-50"}"
        @click=${() => moreInfo(this, cfg.time)}
      >
        <span class="text-[30px] font-semibold leading-none text-ink"
          >${time || "—"}</span
        >
        ${
          windowEnd
            ? html`<span class="ml-2 text-[13px] text-muted"
                >→
                ${windowEnd}${dur ? html` · ${t(hl, "scheduler.duration", { n: dur })}` : ""}</span
              >`
            : ""
        }
      </button>

      ${
        Array.isArray(cfg.days) && cfg.days.length
          ? html`<div class="mt-3 flex flex-wrap gap-x-2 gap-y-[18px]">
              ${cfg.days.map((d) => {
                const obj = typeof d === "object";
                const st = obj ? this._state(d.entity) : null;
                const active = obj ? st && st.state === "on" : true;
                return html`<button
                  type="button"
                  class="fib-hit rounded-full border px-2.5 py-1 text-[10.5px] font-medium
                       ${
                         active
                           ? "border-accentline bg-accentbg text-accent"
                           : "border-line bg-card2 text-ink2"
                       }"
                  @click=${() =>
                    obj &&
                    this.hass &&
                    this.hass.callService("homeassistant", "toggle", {
                      entity_id: d.entity,
                    })}
                >
                  ${obj ? d.name : d}
                </button>`;
              })}
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
