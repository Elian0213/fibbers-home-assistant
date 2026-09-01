/* ================================================================== *
 * fibbers-room — room tile that computes its own light state (Uit / N van M aan /
 * Offline; green glow when lit). Tap → sheet, hold → more-info.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t } from "../i18n.js";
import { twSheet } from "../tw.js";
import { moreInfo, isUnavail } from "../util.js";
import "../icon.js";

const isLight = (id) => typeof id === "string" && id.startsWith("light.");

export class FibbersRoom extends LitElement {
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
    return {
      type: "custom:fibbers-room",
      name: "Woonkamer",
      icon: "solar:sofa-2-bold-duotone",
      entities: ["light.tv_led_strip"],
      sheet: "woonkamer",
    };
  }

  setConfig(config) {
    if (!config || !config.name) {
      throw new Error("fibbers-room: `name` is required");
    }
    if (config.entities != null && !Array.isArray(config.entities)) {
      throw new Error("fibbers-room: `entities` must be a list");
    }
    if (config.entities == null && !config.area) {
      throw new Error("fibbers-room: provide `entities` or an `area`");
    }
    this._config = config;
  }

  _entities() {
    const c = this._config;
    if (Array.isArray(c.entities)) return c.entities;
    const hass = this.hass;
    if (!c.area || !hass || !hass.entities) return [];
    const devices = hass.devices || {};
    return Object.values(hass.entities)
      .filter((e) => {
        const area = e.area_id || (devices[e.device_id] || {}).area_id;
        return area === c.area && isLight(e.entity_id);
      })
      .map((e) => e.entity_id);
  }
  _lights() {
    return this._entities().filter(isLight);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._timer); // don't let a pending long-press fire after unmount
  }

  _state() {
    const hass = this.hass;
    const hl = this._config.language || hass;
    const lights = this._lights();
    if (!hass || !lights.length)
      return { label: "—", lit: false, offline: false };
    let on = 0,
      avail = 0;
    lights.forEach((id) => {
      const st = hass.states[id];
      if (isUnavail(st)) return;
      avail++;
      if (st.state === "on") on++;
    });
    if (avail === 0)
      return { label: t(hl, "room.offline"), lit: false, offline: true };
    if (on === 0)
      return { label: t(hl, "room.off"), lit: false, offline: false };
    return {
      label: t(hl, "room.state_count", { on, total: lights.length }),
      lit: true,
      offline: false,
    };
  }

  _down() {
    this._held = false;
    // 500ms hold = long-press → more-info (vs a tap, which opens the sheet)
    this._timer = setTimeout(() => {
      this._held = true;
      this._moreInfo();
    }, 500);
  }
  _up() {
    clearTimeout(this._timer);
  }
  _click() {
    if (this._held) return;
    if (this._config.sheet) window.location.hash = this._config.sheet;
  }
  _moreInfo() {
    moreInfo(this, this._lights()[0] || this._entities()[0]);
  }

  render() {
    if (!this._config) return html``;
    const s = this._state();
    return html`<button
      type="button"
      class="block w-full cursor-pointer rounded-[15px] border px-[13px] pb-3 pt-[13px]
             text-left transition-colors active:translate-y-[0.5px]
             ${
               s.lit
                 ? "border-[#2E5238] bg-[linear-gradient(145deg,#1E3427,#132016)]"
                 : "border-line bg-card"
             }
             ${s.offline ? "opacity-[.66]" : ""}"
      @pointerdown=${this._down}
      @pointerup=${this._up}
      @pointercancel=${this._up}
      @pointerleave=${this._up}
      @click=${this._click}
    >
      <fib-icon
        class="block h-[19px] w-[19px] [--mdc-icon-size:19px] ${
          s.lit ? "text-accent" : "text-muted"
        }"
        icon=${this._config.icon || "solar:home-angle-bold-duotone"}
      ></fib-icon>
      <div class="mt-2 text-[13px] font-semibold tracking-tight text-ink">
        ${this._config.name}
      </div>
      <div class="mt-0.5 text-[11px] ${s.offline ? "text-red" : "text-muted"}">
        ${s.label}
      </div>
    </button>`;
  }

  getCardSize() {
    return 1;
  }
  getLayoutOptions() {
    return { grid_columns: 6, grid_rows: 1 };
  }
  getGridOptions() {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }
}
