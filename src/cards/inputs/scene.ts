/* ================================================================== *
 * fibbers-scene — scene tiles; the most-recently-applied one is highlighted.
 * `favourites: N` shows the first N and collapses the rest behind a drawer.
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { t } from "@shared/i18n";
import { twSheet } from "@shared/tw";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
  LovelaceCardConfig,
} from "@/types/home-assistant";
import "@shared/icon";

const activatedAt = (st: HassEntity | null | undefined): number => {
  if (!st) return 0;
  const raw =
    (st.attributes && st.attributes.last_activated) || st.state || null;
  const ts = raw ? Date.parse(raw) : NaN;
  return Number.isNaN(ts) ? 0 : ts;
};

/** A single scene tile in a `fibbers-scene` list. */
export interface SceneConfig {
  scene: string;
  name?: string;
  icon?: string;
}

/** YAML/editor config accepted by `fibbers-scene`. */
export interface ScenesConfig extends LovelaceCardConfig {
  scenes: SceneConfig[];
  favourites?: number;
  language?: string;
}

/**
 * fibbers-scene — scene tiles; the most-recently-applied one is highlighted.
 * `favourites: N` shows the first N and collapses the rest behind a drawer.
 */
@customElement("fibbers-scene")
export class FibbersScene extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config!: ScenesConfig;

  @state() private _open = false;

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Seed config with one example scene — this card takes a list, not a single entity. */
  static getStubConfig(): ScenesConfig {
    return {
      type: "custom:fibbers-scene",
      scenes: [
        {
          name: "Evening",
          icon: "solar:moon-bold-duotone",
          scene: "scene.example",
        },
      ],
    };
  }

  /** Validate + store the config; throws on an empty `scenes` list, a scene missing `scene`, or a bad `favourites`. */
  setConfig(config: ScenesConfig): void {
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
    this.config = config;
    this._open = false;
  }

  private _fav(): number {
    const n = this.config.favourites;
    return n && n < this.config.scenes.length ? n : this.config.scenes.length;
  }

  private _activeIndex(): number {
    if (!this.hass) return -1;
    let best = -1;
    let bestT = 0;
    const { hass } = this;
    this.config.scenes.forEach((s, i) => {
      const ts = activatedAt(hass.states[s.scene]);
      if (ts > bestT) {
        bestT = ts;
        best = i;
      }
    });
    return best;
  }

  /** Render the scene tile grid plus a show-more toggle when favourites hide some. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const fav = this._fav();
    const active = this._activeIndex();
    const total = cfg.scenes.length;
    const hidden = total - fav;

    const tile = (s: SceneConfig, i: number): TemplateResult => {
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
              @click=${() => {
                this._open = !this._open;
              }}
            >
              <span
                >${
                  this._open
                    ? t(hl, "scene.show_less")
                    : t(hl, "scene.show_all", { n: total })
                }</span
              >
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

  /** One masonry row tall. */
  getCardSize(): number {
    return 1;
  }

  /** Sections view: full width, one row. */
  getLayoutOptions(): { grid_columns: string; grid_rows: number } {
    return { grid_columns: "full", grid_rows: 1 };
  }

  /** Grid layout: full width, auto height. */
  getGridOptions(): { columns: string; rows: string } {
    return { columns: "full", rows: "auto" };
  }
}
