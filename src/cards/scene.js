/* ================================================================== *
 * fibbers-scene — scene tiles; the most-recently-applied one is highlighted.
 * `favourites: N` shows the first N and collapses the rest behind a drawer.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { twSheet } from "../tw.js";
import "../icon.js";

const activatedAt = (st) => {
  if (!st) return 0;
  const raw =
    (st.attributes && st.attributes.last_activated) || st.state || null;
  const t = raw ? Date.parse(raw) : NaN;
  return isNaN(t) ? 0 : t;
};

export class FibbersScene extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _open: { state: true },
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
    if (
      config.favourites != null &&
      (!Number.isInteger(config.favourites) || config.favourites < 1)
    ) {
      throw new Error("fibbers-scene: `favourites` must be a positive integer");
    }
    this._config = config;
    this._open = false;
  }

  _fav() {
    const n = this._config.favourites;
    return n && n < this._config.scenes.length ? n : this._config.scenes.length;
  }

  _activeIndex() {
    if (!this.hass) return -1;
    let best = -1,
      bestT = 0;
    this._config.scenes.forEach((s, i) => {
      const t = activatedAt(this.hass.states[s.scene]);
      if (t > bestT) {
        bestT = t;
        best = i;
      }
    });
    return best;
  }

  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const fav = this._fav();
    const active = this._activeIndex();
    const total = cfg.scenes.length;
    const hidden = total - fav;

    const tile = (s, i) => {
      const isActive = i === active;
      const show = i < fav || this._open;
      return html`<button
        type="button"
        ?hidden=${!show}
        class="flex flex-col items-center gap-[7px] rounded-[14px] border p-3.5
               text-ink2 transition-transform active:scale-[.96]
               ${
                 isActive
                   ? "border-[#2E5238] bg-[linear-gradient(145deg,#1E3427,#132016)] text-accenttx"
                   : "border-line bg-card"
               }"
        @click=${() =>
          this.hass &&
          this.hass.callService("scene", "turn_on", { entity_id: s.scene })}
      >
        <fib-icon
          class="h-5 w-5 [--mdc-icon-size:20px] ${
            isActive ? "text-accent" : "text-muted"
          }"
          icon=${s.icon || "solar:palette-bold-duotone"}
        ></fib-icon>
        <span class="text-center text-[11px] font-medium"
          >${s.name || s.scene}</span
        >
      </button>`;
    };

    return html`
      <div class="grid grid-cols-[repeat(auto-fit,minmax(84px,1fr))] gap-2">
        ${cfg.scenes.map(tile)}
      </div>
      ${
        hidden > 0
          ? html`<button
              type="button"
              class="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[11px]
                   border border-line bg-transparent py-[9px] text-[11px] font-medium text-ink2"
              @click=${() => (this._open = !this._open)}
            >
              <span>${this._open ? "Minder" : `Alle ${total} scènes`}</span>
              <fib-icon
                class="h-[15px] w-[15px] text-muted transition-transform [--mdc-icon-size:15px]
                     ${this._open ? "rotate-180" : ""}"
                icon="solar:alt-arrow-down-bold-duotone"
              ></fib-icon>
            </button>`
          : ""
      }
    `;
  }

  getCardSize() {
    return 1;
  }
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }
}
