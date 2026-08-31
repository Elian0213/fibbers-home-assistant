/* ================================================================== *
 * CARD — fibbers-light-row
 *
 * The `.lrow` used inside sheets: a 28px icon box, name, a live value
 * (`Warm · 70%`), and a 6px drag slider bound to brightness_pct. Dragging the
 * track never scrolls the sheet (touch-action: none). Unavailable lights read
 * `Onbereikbaar` with a disabled slider.
 * ================================================================== */
import { styleBlock } from "../tokens.js";
import { runAction } from "../actions.js";

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export class FibbersLightRow extends HTMLElement {
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
    this._render();
  }

  /** What tapping the icon box does — defaults to toggling the light/group. */
  _iconAction() {
    return this._config.icon_tap_action || { action: "toggle" };
  }
  _iconEntity() {
    return this._config.icon_entity || this._config.entity;
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (this._dragging) return; // don't fight the finger
    const id = this._config.entity;
    if (
      !prev ||
      JSON.stringify((prev.states[id] || {}).attributes || {}) !==
        JSON.stringify((hass.states[id] || {}).attributes || {}) ||
      (prev.states[id] || {}).state !== (hass.states[id] || {}).state
    ) {
      this._paint();
    }
  }

  _st() {
    return this._hass && this._hass.states[this._config.entity];
  }

  _pct() {
    const st = this._st();
    if (!st || st.state !== "on") return 0;
    const b = st.attributes.brightness;
    return b != null ? Math.round((b / 255) * 100) : 100;
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

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        ${styleBlock()}
        * { box-sizing: border-box; }
        .row {
          display: grid;
          grid-template-columns: 28px 1fr;
          grid-template-rows: auto auto;
          column-gap: 10px; row-gap: 8px;
          align-items: center;
          padding: 8px 2px;
        }
        .ic {
          grid-row: 1 / span 2;
          width: 28px; height: 28px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          background: var(--fib-card-2);
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          transition: transform .08s ease, background .15s ease;
        }
        .ic[data-pressed="true"] { transform: scale(.92); }
        .ic fib-icon { --mdc-icon-size: 17px; width: 17px; height: 17px; color: var(--fib-muted); }
        .row[data-on="true"] .ic { background: var(--fib-accent-bg); }
        .row[data-on="true"] .ic fib-icon { color: var(--fib-accent); }
        .row[data-unavail="true"] .ic { pointer-events: none; }
        .head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
        .name { font-size: 12px; font-weight: 500; color: var(--fib-ink); }
        .val { font-size: 10.5px; color: var(--fib-muted); white-space: nowrap; }
        .track {
          position: relative;
          height: 6px; border-radius: 3px;
          background: #2C3639;
          touch-action: none;
          cursor: pointer;
        }
        .fill {
          position: absolute; left: 0; top: 0; bottom: 0;
          border-radius: 3px;
          background: var(--fib-accent);
          width: 0%;
        }
        .knob {
          position: absolute; top: 50%;
          width: 14px; height: 14px; border-radius: 50%;
          background: var(--fib-accent);
          transform: translate(-50%, -50%);
          left: 0%;
          box-shadow: 0 1px 3px rgba(0,0,0,.4);
        }
        .row[data-unavail="true"] { opacity: .5; }
        .row[data-unavail="true"] .track { pointer-events: none; }
        .row[data-unavail="true"] .fill, .row[data-unavail="true"] .knob { display: none; }
      </style>
      <div class="row">
        <div class="ic"><fib-icon></fib-icon></div>
        <div class="head"><span class="name"></span><span class="val"></span></div>
        <div class="track"><div class="fill"></div><div class="knob"></div></div>
      </div>`;

    const row = this.shadowRoot.querySelector(".row");
    const track = row.querySelector(".track");
    const setFrom = (clientX, commit) => {
      const r = track.getBoundingClientRect();
      const pct = Math.round(
        clamp(((clientX - r.left) / r.width) * 100, 0, 100),
      );
      this._preview(pct);
      if (commit) this._commit(pct);
    };
    track.addEventListener("pointerdown", (e) => {
      if (this._isUnavail()) return;
      this._dragging = true;
      track.setPointerCapture && track.setPointerCapture(e.pointerId);
      setFrom(e.clientX, false);
    });
    track.addEventListener("pointermove", (e) => {
      if (!this._dragging) return;
      setFrom(e.clientX, false);
    });
    const end = (e) => {
      if (!this._dragging) return;
      this._dragging = false;
      setFrom(e.clientX, true);
    };
    track.addEventListener("pointerup", end);
    track.addEventListener("pointercancel", () => (this._dragging = false));

    // tap the name/value → more-info
    row
      .querySelector(".head")
      .addEventListener("click", () => this._moreInfo());

    // tap the icon box → its configured action (defaults to toggling the light)
    const ic = row.querySelector(".ic");
    ic.setAttribute("role", "button");
    ic.addEventListener("pointerdown", () =>
      ic.setAttribute("data-pressed", "true"),
    );
    ["pointerup", "pointercancel", "pointerleave"].forEach((ev) =>
      ic.addEventListener(ev, () => ic.removeAttribute("data-pressed")),
    );
    ic.addEventListener("click", () =>
      runAction(this._iconAction(), this._hass, this, this._iconEntity()),
    );

    this._paint();
  }

  _isUnavail() {
    const st = this._st();
    return !st || st.state === "unavailable" || st.state === "unknown";
  }

  _preview(pct) {
    const row = this.shadowRoot.querySelector(".row");
    row.querySelector(".fill").style.width = pct + "%";
    row.querySelector(".knob").style.left = pct + "%";
    row.querySelector(".val").textContent = pct + "%";
    row.setAttribute("data-on", String(pct > 0));
  }

  _commit(pct) {
    const hass = this._hass;
    if (!hass) return;
    const entity_id = this._config.entity;
    if (pct <= 0) hass.callService("light", "turn_off", { entity_id });
    else
      hass.callService("light", "turn_on", { entity_id, brightness_pct: pct });
  }

  _paint() {
    if (!this.shadowRoot) return;
    const row = this.shadowRoot.querySelector(".row");
    const st = this._st();
    const name =
      this._config.name ||
      (st && st.attributes.friendly_name) ||
      this._config.entity;
    row.querySelector(".name").textContent = name;
    row
      .querySelector(".ic fib-icon")
      .setAttribute(
        "icon",
        this._config.icon ||
          (st && st.attributes.icon) ||
          "solar:lightbulb-bold-duotone",
      );

    if (this._isUnavail()) {
      row.setAttribute("data-unavail", "true");
      row.setAttribute("data-on", "false");
      row.querySelector(".val").textContent = "Onbereikbaar";
      return;
    }
    row.removeAttribute("data-unavail");
    const on = st.state === "on";
    row.setAttribute("data-on", String(on));
    const pct = this._pct();
    row.querySelector(".fill").style.width = pct + "%";
    row.querySelector(".knob").style.left = pct + "%";
    if (on) {
      const w = this._warmth();
      row.querySelector(".val").textContent = w ? `${w} · ${pct}%` : `${pct}%`;
    } else {
      row.querySelector(".val").textContent = "Uit";
    }
  }

  _moreInfo() {
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: this._config.entity },
        bubbles: true,
        composed: true,
      }),
    );
  }

  getCardSize() {
    return 1;
  }

  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
}
