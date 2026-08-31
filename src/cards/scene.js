/* ================================================================== *
 * CARD — fibbers-scene
 *
 * A row of scene tiles. Tapping one activates it; the most recently applied
 * scene (highest last_activated across the configured set) is highlighted.
 * ================================================================== */
import { styleBlock } from "../tokens.js";

const activatedAt = (st) => {
  if (!st) return 0;
  const raw =
    (st.attributes && st.attributes.last_activated) || st.state || null;
  const t = raw ? Date.parse(raw) : NaN;
  return isNaN(t) ? 0 : t;
};

export class FibbersScene extends HTMLElement {
  static getStubConfig() {
    return {
      type: "custom:fibbers-scene",
      scenes: [
        {
          name: "Avond",
          icon: "solar:moon-bold-duotone",
          scene: "scene.avond",
        },
      ],
    };
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.scenes) || !config.scenes.length) {
      throw new Error("fibbers-scene: `scenes` must be a non-empty list");
    }
    config.scenes.forEach((s, i) => {
      if (!s || !s.scene)
        throw new Error(`fibbers-scene: scenes[${i}] is missing \`scene\``);
    });
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._paint();
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        ${styleBlock()}
        * { box-sizing: border-box; }
        .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(72px, 1fr)); gap: 8px; }
        .tile {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 12px 8px;
          border-radius: 13px;
          background: var(--fib-card);
          border: 1px solid var(--fib-line);
          color: var(--fib-ink-2);
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .tile[data-active="true"] {
          background: linear-gradient(145deg, #1E3427, #132016);
          border-color: #2E5238;
          color: var(--fib-accent-tx);
        }
        .tile fib-icon { --mdc-icon-size: 17px; width: 17px; height: 17px; color: var(--fib-muted); }
        .tile[data-active="true"] fib-icon { color: var(--fib-accent); }
        .label { font-size: 10px; font-weight: 500; }
      </style>
      <div class="row"></div>`;
    const row = this.shadowRoot.querySelector(".row");
    this._config.scenes.forEach((s, i) => {
      const el = document.createElement("button");
      el.className = "tile";
      el.type = "button";
      el.dataset.i = String(i);
      const ic = document.createElement("fib-icon");
      ic.setAttribute("icon", s.icon || "solar:palette-bold-duotone");
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = s.name || s.scene;
      el.append(ic, label);
      el.addEventListener("click", () => {
        if (this._hass)
          this._hass.callService("scene", "turn_on", { entity_id: s.scene });
      });
      row.appendChild(el);
    });
    this._paint();
  }

  _paint() {
    if (!this.shadowRoot || !this._hass) return;
    let best = -1,
      bestT = 0;
    this._config.scenes.forEach((s, i) => {
      const t = activatedAt(this._hass.states[s.scene]);
      if (t > bestT) {
        bestT = t;
        best = i;
      }
    });
    this.shadowRoot.querySelectorAll(".tile").forEach((el) => {
      el.setAttribute(
        "data-active",
        String(+el.dataset.i === best && bestT > 0),
      );
    });
  }

  getCardSize() {
    return 1;
  }

  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
}
