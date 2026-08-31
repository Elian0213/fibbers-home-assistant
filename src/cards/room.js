/* ================================================================== *
 * CARD — fibbers-room
 *
 * The room tile from the mockup. Computes its own state from the light
 * entities (no Jinja in config): Uit / N van M aan / Offline. Lit rooms get a
 * green glow; all-unavailable rooms dim with red state text. Tap opens a
 * sheet; hold opens more-info for the group.
 * ================================================================== */
import { styleBlock } from "../tokens.js";

const isLight = (id) => typeof id === "string" && id.startsWith("light.");

export class FibbersRoom extends HTMLElement {
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
    this._render();
  }

  /** Resolve the entities: explicit list, or derived from an area. */
  _entities() {
    const c = this._config;
    if (Array.isArray(c.entities)) return c.entities;
    const hass = this._hass;
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

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!prev) return this._paint();
    // cheap diff: repaint only if a watched light changed
    const changed = this._lights().some(
      (id) => (prev.states[id] || {}).state !== (hass.states[id] || {}).state,
    );
    if (changed) this._paint();
  }

  _state() {
    const hass = this._hass;
    const lights = this._lights();
    if (!hass || !lights.length)
      return { label: "—", lit: false, offline: false };
    let on = 0,
      avail = 0;
    lights.forEach((id) => {
      const st = hass.states[id];
      if (!st || st.state === "unavailable" || st.state === "unknown") return;
      avail++;
      if (st.state === "on") on++;
    });
    if (avail === 0) return { label: "Offline", lit: false, offline: true };
    if (on === 0) return { label: "Uit", lit: false, offline: false };
    return {
      label: `${on} van ${lights.length} aan`,
      lit: true,
      offline: false,
    };
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        ${styleBlock()}
        * { box-sizing: border-box; }
        .tile {
          display: block; width: 100%; text-align: left;
          background: var(--fib-card);
          border: 1px solid var(--fib-line);
          border-radius: 15px;
          padding: 13px 13px 12px;
          color: var(--fib-ink);
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          transition: background .15s ease, border-color .15s ease;
        }
        .tile[data-lit="true"] {
          background: linear-gradient(145deg, #1E3427, #132016);
          border-color: #2E5238;
        }
        .tile[data-offline="true"] { opacity: .66; }
        .tile:active { transform: translateY(.5px); }
        fib-icon { --mdc-icon-size: 19px; width: 19px; height: 19px; color: var(--fib-muted); display: block; }
        .tile[data-lit="true"] fib-icon { color: var(--fib-accent); }
        .name { font-size: 13px; font-weight: 600; letter-spacing: -.01em; margin-top: 8px; }
        .state { font-size: 11px; color: var(--fib-muted); margin-top: 2px; }
        .tile[data-offline="true"] .state { color: var(--fib-red); }
      </style>
      <div class="tile" role="button" tabindex="0">
        <fib-icon></fib-icon>
        <div class="name"></div>
        <div class="state"></div>
      </div>`;
    const tile = this.shadowRoot.querySelector(".tile");
    tile
      .querySelector("fib-icon")
      .setAttribute(
        "icon",
        this._config.icon || "solar:home-angle-bold-duotone",
      );
    tile.querySelector(".name").textContent = this._config.name;

    // tap → open sheet; hold → more-info
    let holdTimer = null,
      held = false;
    const down = () => {
      held = false;
      holdTimer = setTimeout(() => {
        held = true;
        this._moreInfo();
      }, 500);
    };
    const up = () => clearTimeout(holdTimer);
    tile.addEventListener("pointerdown", down);
    ["pointerup", "pointercancel", "pointerleave"].forEach((ev) =>
      tile.addEventListener(ev, up),
    );
    tile.addEventListener("click", () => {
      if (held) return;
      if (this._config.sheet) window.location.hash = this._config.sheet;
    });
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (this._config.sheet) window.location.hash = this._config.sheet;
      }
    });
    this._paint();
  }

  _paint() {
    if (!this.shadowRoot) return;
    const tile = this.shadowRoot.querySelector(".tile");
    if (!tile) return;
    const s = this._state();
    tile.setAttribute("data-lit", String(s.lit));
    tile.setAttribute("data-offline", String(s.offline));
    tile.querySelector(".state").textContent = s.label;
  }

  _moreInfo() {
    const ent = this._lights()[0] || this._entities()[0];
    if (!ent) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: ent },
        bubbles: true,
        composed: true,
      }),
    );
  }

  getCardSize() {
    return 1;
  }

  getLayoutOptions() {
    return { grid_columns: 6, grid_rows: 1 };
  }
}
