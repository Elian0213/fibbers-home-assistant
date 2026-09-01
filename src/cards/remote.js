/* ================================================================== *
 * fibbers-remote — power, D-pad, back/home/menu, volume/playback via
 * remote.send_command; override the mapping via `commands`.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { twSheet } from "../tw.js";
import "../icon.js";

const DEFAULTS = {
  power: "POWER",
  up: "DPAD_UP",
  down: "DPAD_DOWN",
  left: "DPAD_LEFT",
  right: "DPAD_RIGHT",
  ok: "DPAD_CENTER",
  back: "BACK",
  home: "HOME",
  menu: "MENU",
  volume_up: "VOLUME_UP",
  volume_down: "VOLUME_DOWN",
  play: "MEDIA_PLAY_PAUSE",
};

export class FibbersRemote extends LitElement {
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
    return { type: "custom:fibbers-remote", entity: "remote.woonkamer_tv" };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("fibbers-remote: `entity` (a remote.*) is required");
    }
    this._config = config;
  }

  _send(key) {
    const cmd = (this._config.commands || {})[key] || DEFAULTS[key];
    if (cmd && this.hass)
      this.hass.callService("remote", "send_command", {
        entity_id: this._config.entity,
        command: cmd,
      });
  }

  _btn(key, icon, opts = {}) {
    const round = opts.round !== false;
    const accent = opts.accent;
    return html`<button
      type="button"
      class="flex items-center justify-center ${
        round ? "rounded-full" : "rounded-xl"
      } ${opts.size || "h-11 w-11"}
             ${accent ? "bg-accentbg text-accent" : "bg-card2 text-ink"}
             transition-transform active:scale-90"
      @click=${() => this._send(key)}
      aria-label=${key}
    >
      <fib-icon
        class="h-[20px] w-[20px] [--mdc-icon-size:20px]"
        icon=${icon}
      ></fib-icon>
    </button>`;
  }

  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    return html`<div
      class="flex flex-col items-center gap-3 rounded-[14px] border border-line bg-card p-[13px]"
    >
      <div class="flex w-full items-center justify-between">
        <span
          class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
          >${cfg.name || "Afstandsbediening"}</span
        >
        ${this._btn("power", "solar:power-bold-duotone", {
          size: "h-9 w-9",
          accent: true,
        })}
      </div>

      <!-- D-pad -->
      <div class="grid grid-cols-3 gap-2">
        <span></span>
        ${this._btn("up", "solar:alt-arrow-up-bold-duotone")}
        <span></span>
        ${this._btn("left", "solar:alt-arrow-left-bold-duotone")}
        ${this._btn("ok", "solar:record-circle-bold-duotone", { accent: true })}
        ${this._btn("right", "solar:alt-arrow-right-bold-duotone")}
        <span></span>
        ${this._btn("down", "solar:alt-arrow-down-bold-duotone")}
        <span></span>
      </div>

      <div class="flex gap-2">
        ${this._btn("back", "solar:alt-arrow-left-bold-duotone", { size: "h-9 w-9" })}
        ${this._btn("home", "solar:home-2-bold-duotone", { size: "h-9 w-9" })}
        ${this._btn("menu", "solar:menu-dots-bold-duotone", { size: "h-9 w-9" })}
      </div>

      <div class="flex gap-2">
        ${this._btn("volume_down", "solar:volume-small-bold-duotone", { size: "h-9 w-9" })}
        ${this._btn("play", "solar:play-bold-duotone", { size: "h-9 w-9" })}
        ${this._btn("volume_up", "solar:volume-loud-bold-duotone", { size: "h-9 w-9" })}
      </div>
    </div>`;
  }

  getCardSize() {
    return 4;
  }
  getLayoutOptions() {
    return { grid_columns: 6, grid_rows: 4 };
  }
  getGridOptions() {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }
}
