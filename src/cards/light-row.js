/* ================================================================== *
 * CARD — fibbers-light-row  (Lit + Tailwind)
 *
 * The light row used inside sheets: a 28px icon box, a name, a live value
 * (`Warm · 70%`), and a 6px drag slider bound to brightness_pct. Dragging the
 * track never scrolls the sheet (touch-none). Unavailable lights read
 * `Onbereikbaar` with a disabled slider.
 *
 * Interactive proof for the Lit + Tailwind stack: pointer capture + drag inside
 * a shadow root under Lit, with reactive drag state driving the knob.
 * ================================================================== */
import { LitElement, html, css } from "lit";
import { twSheet } from "../tw.js";
import { runAction } from "../actions.js";
import { moreInfo, clamp } from "../util.js";
import "../icon.js";

export class FibbersLightRow extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _dragging: { state: true },
    _dragPct: { state: true },
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
    return { type: "custom:fibbers-light-row", entity: "light.tv_led_strip" };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("fibbers-light-row: `entity` is required");
    }
    if (
      config.icon_tap_action != null &&
      (typeof config.icon_tap_action !== "object" ||
        typeof config.icon_tap_action.action !== "string")
    ) {
      throw new Error(
        "fibbers-light-row: `icon_tap_action` must be a HA action object (with an `action`)",
      );
    }
    this._config = config;
    this._dragging = false;
    this._dragPct = 0;
  }

  _st() {
    return this.hass && this.hass.states[this._config.entity];
  }
  _unavail() {
    const st = this._st();
    return !st || st.state === "unavailable" || st.state === "unknown";
  }
  _pctFromHass() {
    const st = this._st();
    if (!st || st.state !== "on") return 0;
    const b = st.attributes.brightness;
    return b != null ? Math.round((b / 255) * 100) : 100;
  }
  _displayPct() {
    return this._dragging ? this._dragPct : this._pctFromHass();
  }

  _warmth() {
    const st = this._st();
    if (!st) return "";
    const mode = st.attributes.color_mode;
    if (mode && ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(mode))
      return "Kleur";
    const k =
      st.attributes.color_temp_kelvin ||
      (st.attributes.color_temp
        ? Math.round(1e6 / st.attributes.color_temp)
        : null);
    if (k == null) return "";
    if (k < 3000) return "Warm";
    if (k < 4600) return "Neutraal";
    return "Koel";
  }

  _pctFromX(clientX, track) {
    const r = track.getBoundingClientRect();
    return Math.round(clamp(((clientX - r.left) / r.width) * 100, 0, 100));
  }

  _down(e) {
    if (this._unavail()) return;
    const track = e.currentTarget;
    this._dragging = true;
    track.setPointerCapture && track.setPointerCapture(e.pointerId);
    this._dragPct = this._pctFromX(e.clientX, track);
  }
  _move(e) {
    if (!this._dragging) return;
    this._dragPct = this._pctFromX(e.clientX, e.currentTarget);
  }
  _up(e) {
    if (!this._dragging) return;
    const pct = this._pctFromX(e.clientX, e.currentTarget);
    this._dragging = false;
    this._commit(pct);
  }
  _commit(pct) {
    if (!this.hass) return;
    const entity_id = this._config.entity;
    if (pct <= 0) this.hass.callService("light", "turn_off", { entity_id });
    else
      this.hass.callService("light", "turn_on", {
        entity_id,
        brightness_pct: pct,
      });
  }

  _iconAction() {
    return this._config.icon_tap_action || { action: "toggle" };
  }
  _moreInfo() {
    moreInfo(this, this._config.entity);
  }

  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const st = this._st();
    const unavail = this._unavail();
    const on = !unavail && st.state === "on";
    const pct = this._displayPct();
    const name = cfg.name || (st && st.attributes.friendly_name) || cfg.entity;
    const icon =
      cfg.icon || (st && st.attributes.icon) || "solar:lightbulb-bold-duotone";

    let val;
    if (unavail) val = "Onbereikbaar";
    else if (on) {
      const w = this._warmth();
      val = w ? `${w} · ${pct}%` : `${pct}%`;
    } else val = "Uit";

    return html`
      <div
        class="grid grid-cols-[28px_1fr] grid-rows-[auto_auto] items-center gap-x-2.5
               gap-y-2 py-2 ${unavail ? "opacity-50" : ""}"
      >
        <div
          role="button"
          class="row-span-2 flex h-7 w-7 items-center justify-center rounded-lg
                 transition-transform active:scale-90 ${
                   on ? "bg-accentbg" : "bg-card2"
                 } ${unavail ? "pointer-events-none" : "cursor-pointer"}"
          @click=${() =>
            runAction(
              this._iconAction(),
              this.hass,
              this,
              cfg.icon_entity || cfg.entity,
            )}
        >
          <fib-icon
            class="h-[17px] w-[17px] [--mdc-icon-size:17px] ${
              on ? "text-accent" : "text-muted"
            }"
            icon=${icon}
          ></fib-icon>
        </div>

        <div
          class="flex cursor-pointer items-baseline justify-between gap-2"
          @click=${() => this._moreInfo()}
        >
          <span class="text-[12px] font-medium text-ink">${name}</span>
          <span class="whitespace-nowrap text-[10.5px] text-muted">${val}</span>
        </div>

        <div
          class="relative h-1.5 cursor-pointer touch-none rounded-[3px] bg-[#2C3639]
                 ${unavail ? "pointer-events-none" : ""}"
          @pointerdown=${this._down}
          @pointermove=${this._move}
          @pointerup=${this._up}
          @pointercancel=${() => (this._dragging = false)}
        >
          ${
            unavail
              ? ""
              : html`
                  <div
                    class="absolute bottom-0 left-0 top-0 rounded-[3px] bg-accent"
                    style="width:${pct}%"
                  ></div>
                  <div
                    class="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2
                         rounded-full bg-accent shadow-[0_1px_3px_rgba(0,0,0,.4)]"
                    style="left:${pct}%"
                  ></div>
                `
          }
        </div>
      </div>
    `;
  }

  getCardSize() {
    return 1;
  }
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
}
