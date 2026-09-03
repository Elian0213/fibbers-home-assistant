/* ================================================================== *
 * fibbers-light-row — the light row for sheets: icon, name, live value
 * (`Warm · 70%`), and a drag slider bound to brightness_pct.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { runAction } from "../../shared/actions.js";
import { t } from "../../shared/i18n.js";
import { twSheet } from "../../shared/tw.js";
import {
  sliderTrack,
  sliderDrag,
  pillSwitch,
  activateOnKey,
  SliderHold,
} from "../../shared/ui.js";
import {
  moreInfo,
  isUnavail,
  pctFromX,
  pickEntity,
  debounce,
} from "../../shared/util.js";
import "../../shared/icon.js";

const EDITOR_SCHEMA = [
  { name: "entity", selector: { entity: { domain: "light" } } },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
];

/**
 * fibbers-light-row — the light row for sheets: icon, name, live value
 * (`Warm · 70%`), and a drag slider bound to brightness_pct.
 */
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

  /** HA calls this to seed a fresh card — pick a real light so the default isn't empty. */
  static getStubConfig(hass, entities, entitiesFallback) {
    return {
      type: "custom:fibbers-light-row",
      entity: pickEntity("light", entities, entitiesFallback, "light.example"),
    };
  }

  /** The visual editor: hand HA a shared form-editor driven by this card's schema. */
  static getConfigElement() {
    const el = document.createElement("fibbers-form-editor");
    el.schema = EDITOR_SCHEMA;
    return el;
  }

  /** Validate + store the config; throws on a missing entity / malformed action so the editor surfaces it. */
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
    this._debouncedCommit = debounce((v) => this._commit(v), 150);
    // Shared drag gesture: live-track past the slop, final value wins on release.
    this._drag = sliderDrag({
      guard: () => this._unavail(),
      read: (e) => Math.round(pctFromX(e.clientX, e.currentTarget)),
      frame: (v, dragging) => {
        this._dragging = dragging;
        if (v != null) this._dragPct = v;
      },
      live: (v) => this._debouncedCommit(v),
      end: (v) => {
        this._debouncedCommit.cancel();
        if (v != null) this._commit(v);
      },
    });
    // Construct the hold once — SliderHold.addController has no counterpart, so a
    // fresh one per setConfig (HA calls it per keystroke in the editor) would
    // orphan controllers on the element.
    if (!this._hold)
      this._hold = new SliderHold(this, { tolerance: 2, timeout: 5000 });
    else this._hold.clear();
  }

  /** Drop any trailing debounced write so a torn-down row can't fire late. */
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._debouncedCommit) this._debouncedCommit.cancel();
  }

  // An on/off-only light (supported_color_modes === ["onoff"]) has no brightness,
  // so the drag slider is meaningless — render a plain toggle instead. Absent the
  // attribute (legacy) we assume dimmable.
  _dimmable() {
    const st = this._st();
    const modes = st && st.attributes.supported_color_modes;
    return !Array.isArray(modes) || modes.some((m) => m !== "onoff");
  }

  _st() {
    return this.hass && this.hass.states[this._config.entity];
  }
  _unavail() {
    return isUnavail(this._st());
  }
  _pctFromHass() {
    const st = this._st();
    if (!st || st.state !== "on") return 0;
    const b = st.attributes.brightness;
    return b != null ? Math.round((b / 255) * 100) : 100;
  }
  _displayPct() {
    return this._hold.value(this._pctFromHass(), {
      dragging: this._dragging,
      dragValue: this._dragPct,
      gone: this._unavail(),
    });
  }

  _warmth() {
    const st = this._st();
    if (!st) return "";
    const hl = this._config.language || this.hass;
    const mode = st.attributes.color_mode;
    if (mode && ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(mode))
      return t(hl, "light_row.color");
    const k =
      st.attributes.color_temp_kelvin ||
      (st.attributes.color_temp
        ? Math.round(1e6 / st.attributes.color_temp)
        : null);
    if (k == null) return "";
    if (k < 3000) return t(hl, "light_row.warm");
    if (k < 4600) return t(hl, "light_row.neutral");
    return t(hl, "light_row.cool");
  }

  _commit(pct) {
    if (!this.hass) return;
    this._hold.hold(pct); // show the committed value until the bulb catches up
    const entity_id = this._config.entity;
    const p =
      pct <= 0
        ? this.hass.callService("light", "turn_off", { entity_id })
        : this.hass.callService("light", "turn_on", {
            entity_id,
            brightness_pct: pct,
          });
    // A failed service call must not freeze the display on the optimistic value.
    Promise.resolve(p).catch(() => this._hold.clear());
  }
  _toggle() {
    if (!this.hass || this._unavail()) return;
    this.hass.callService("light", "toggle", {
      entity_id: this._config.entity,
    });
  }

  _iconAction() {
    return this._config.icon_tap_action || { action: "toggle" };
  }
  _moreInfo() {
    moreInfo(this, this._config.entity);
  }

  /** Draw the row: icon action, name → more-info, and a dimmer slider or plain toggle. */
  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const st = this._st();
    const hl = cfg.language || this.hass;
    const unavail = this._unavail();
    const on = !unavail && st.state === "on";
    const dimmable = this._dimmable();
    const pct = this._displayPct();
    const name = cfg.name || (st && st.attributes.friendly_name) || cfg.entity;
    const icon =
      cfg.icon || (st && st.attributes.icon) || "solar:lightbulb-bold-duotone";

    let val;
    if (unavail) val = t(hl, "light_row.unavailable");
    else if (on && !dimmable) val = t(hl, "light_row.on");
    else if (on) {
      const w = this._warmth();
      val = w ? `${w} · ${pct}%` : `${pct}%`;
    } else val = t(hl, "light_row.off");

    return html`
      <div
        class="grid grid-cols-[28px_1fr] grid-rows-[auto_auto] items-center gap-x-2.5
               gap-y-0 ${unavail ? "opacity-50" : ""}"
      >
        <div
          role="button"
          tabindex=${unavail ? -1 : 0}
          aria-label=${name}
          class="fib-hit row-span-2 flex h-7 w-7 items-center justify-center rounded-lg
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
          @keydown=${activateOnKey(() =>
            runAction(
              this._iconAction(),
              this.hass,
              this,
              cfg.icon_entity || cfg.entity,
            ),
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
          role="button"
          tabindex="0"
          aria-label=${`${name} — ${t(hl, "common.more_info")}`}
          class="flex min-h-[var(--fib-hit)] cursor-pointer items-center justify-between gap-2"
          @click=${() => this._moreInfo()}
          @keydown=${activateOnKey(() => this._moreInfo())}
        >
          <span class="text-[12px] font-medium text-ink">${name}</span>
          <span class="whitespace-nowrap text-[10.5px] text-muted">${val}</span>
        </div>

        ${
          dimmable
            ? sliderTrack({
                pct,
                disabled: unavail,
                label: name,
                value: pct,
                min: 0,
                max: 100,
                step: 5,
                valueText: `${pct}%`,
                // Keyboard: arm the hold now (display advances, held keys keep
                // stepping) but debounce the write — auto-repeat fired ~30
                // light.turn_on calls a second straight at the committer.
                onInput: (v) => {
                  const p = Math.round(v);
                  this._hold.hold(p);
                  this._debouncedCommit(p);
                },
                onDown: this._drag.down,
                onMove: this._drag.move,
                onUp: this._drag.up,
                onCancel: this._drag.cancel,
              })
            : html`<div class="flex min-h-[var(--fib-hit)] items-center">
                ${pillSwitch({
                  on,
                  label: name,
                  onClick: () => this._toggle(),
                })}
              </div>`
        }
      </div>
    `;
  }

  /** Masonry height hint — a single-line row. */
  getCardSize() {
    return 1;
  }
  /** Sections-view layout: full-width, one row tall. */
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
  /** Grid-view sizing: full-width, auto height. */
  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }
}
