/* ================================================================== *
 * fibbers-select — option picker for input_select/select: a chip row for few
 * options, else a self-styled dropdown (never ha-select). Closes on outside-click.
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { t } from "@shared/i18n";
import { twSheet } from "@shared/tw";
import { pickEntity } from "@shared/util";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
} from "@/types/home-assistant";
import "@shared/icon";

const DOMAINS = ["input_select", "select"];

const EDITOR_SCHEMA = [
  { name: "entity", selector: { entity: { domain: DOMAINS } } },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
  {
    name: "mode",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "chips", label: "Chips" },
          { value: "dropdown", label: "Dropdown" },
        ],
      },
    },
  },
  { name: "chips_max", selector: { number: { min: 1, mode: "box" } } },
];

/** YAML/editor config accepted by `fibbers-select`. */
export interface SelectConfig extends LovelaceCardConfig {
  entity: string;
  name?: string;
  icon?: string;
  mode?: "chips" | "dropdown";
  chips_max?: number;
  language?: string;
}

/**
 * fibbers-select — option picker for input_select/select: a chip row for few
 * options, else a self-styled dropdown (never ha-select). Closes on outside-click.
 */
@customElement("fibbers-select")
export class FibbersSelect extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config!: SelectConfig;

  @state() private _open = false;

  private _outside: ((e: MouseEvent) => void) | null = null;

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Seed config for the picker — an input_select entity from the dashboard, or a placeholder. */
  static getStubConfig(
    _hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[],
  ): SelectConfig {
    return {
      type: "custom:fibbers-select",
      entity: pickEntity(
        "input_select",
        entities,
        entitiesFallback,
        "input_select.example",
      ),
    };
  }

  /** Build the shared form editor bound to this card's schema. */
  static getConfigElement(): LovelaceCardEditor {
    const el = document.createElement(
      "fibbers-form-editor",
    ) as LovelaceCardEditor & {
      schema?: unknown;
    };
    el.schema = EDITOR_SCHEMA;
    return el;
  }

  /** Validate + store the config; throws when the entity isn't an input_select/select. */
  setConfig(config: SelectConfig): void {
    if (!config || !config.entity) {
      throw new Error("fibbers-select: `entity` is required");
    }
    if (!DOMAINS.includes(String(config.entity).split(".")[0])) {
      throw new Error(
        "fibbers-select: `entity` must be an input_select.* or select.*",
      );
    }
    this.config = config;
    this._open = false;
  }

  /** Drop the document-level outside-click listener so a closed menu can't leak it. */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._removeOutside();
  }

  private _st(): HassEntity | undefined {
    return this.hass && this.hass.states[this.config.entity];
  }

  private _options(): string[] {
    const st = this._st();
    return (st && st.attributes && st.attributes.options) || [];
  }

  private _current(): string {
    const st = this._st();
    return st ? st.state : "";
  }

  private _select(opt: string): void {
    if (this.hass) {
      const domain = this.config.entity.split(".")[0];
      this.hass.callService(domain, "select_option", {
        entity_id: this.config.entity,
        option: opt,
      });
    }
    this._close();
  }

  private _openMenu(): void {
    this._removeOutside(); // drop any stale listener before re-opening
    this._open = true;
    this._outside = (e: MouseEvent) => {
      if (!e.composedPath().includes(this)) this._close();
    };
    // defer so the opening click doesn't immediately close it
    setTimeout(() => document.addEventListener("click", this._outside!), 0);
  }

  private _close(): void {
    this._open = false;
    this._removeOutside();
  }

  private _removeOutside(): void {
    if (this._outside) {
      document.removeEventListener("click", this._outside);
      this._outside = null;
    }
  }

  /** Render chips or dropdown per `mode` (auto: chips when options ≤ chips_max). */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const st = this._st();
    if (!st) {
      return html`<div
        class="rounded-[14px] border border-line bg-card p-[13px] text-[12px] text-muted"
      >
        ${t(hl, "common.not_available")}
      </div>`;
    }
    const name = cfg.name || st.attributes.friendly_name || cfg.entity;
    const icon = cfg.icon || st.attributes.icon || "solar:list-bold-duotone";
    const options = this._options();
    const current = this._current();
    const max = cfg.chips_max != null ? cfg.chips_max : 6;
    let mode: "chips" | "dropdown";
    if (cfg.mode === "chips" || cfg.mode === "dropdown") mode = cfg.mode;
    else mode = options.length <= max ? "chips" : "dropdown";

    const header = html`<div class="mb-2 flex items-center gap-2.5">
      <div
        class="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-accentbg text-accent"
      >
        <fib-icon
          class="h-[17px] w-[17px] [--mdc-icon-size:17px]"
          icon=${icon}
        ></fib-icon>
      </div>
      <span class="flex-1 text-[12px] font-medium text-ink">${name}</span>
    </div>`;

    const body =
      mode === "chips"
        ? html`<div class="flex flex-wrap gap-x-2 gap-y-[18px]">
            ${options.map((o) => {
              const active = o === current;
              return html`<button
                type="button"
                class="fib-hit rounded-full border px-2.5 py-1 text-[10.5px] font-medium
                       ${
                         active
                           ? "border-accentline bg-accentbg text-accent"
                           : "border-line bg-card2 text-ink2"
                       }"
                @click=${() => this._select(o)}
              >
                ${o}
              </button>`;
            })}
          </div>`
        : html`<div class="relative">
            <button
              type="button"
              class="flex w-full items-center justify-between gap-2 rounded-[10px] border border-line
                     bg-card2 px-3 py-2 text-left text-[12px] font-medium text-ink"
              aria-haspopup="listbox"
              aria-expanded=${this._open ? "true" : "false"}
              @click=${() => (this._open ? this._close() : this._openMenu())}
            >
              <span class="truncate">${current || "—"}</span>
              <fib-icon
                class="h-4 w-4 flex-none [--mdc-icon-size:16px] text-muted transition-transform
                       ${this._open ? "rotate-180" : ""}"
                icon="solar:alt-arrow-down-bold-duotone"
              ></fib-icon>
            </button>
            ${
              this._open
                ? // eslint-disable-next-line lit-a11y/accessible-name -- self-styled menu; the trigger button carries the label
                  html`<div
                    class="absolute left-0 right-0 top-[calc(100%+4px)] z-10 max-h-[220px] overflow-auto overscroll-contain
                         rounded-[10px] border border-line bg-card p-1 shadow-[0_10px_30px_rgba(0,0,0,.5)]"
                    role="listbox"
                  >
                    ${options.map(
                      (o) =>
                        html`<button
                          type="button"
                          role="option"
                          aria-selected=${o === current ? "true" : "false"}
                          class="flex w-full items-center justify-between gap-2 rounded-[7px] px-2.5 py-2
                             text-left text-[12px] hover:bg-card2
                             ${o === current ? "text-accent" : "text-ink"}"
                          @click=${() => this._select(o)}
                        >
                          <span class="truncate">${o}</span>
                          ${
                            o === current
                              ? html`<fib-icon
                                  class="h-4 w-4 flex-none [--mdc-icon-size:16px] text-accent"
                                  icon="solar:check-circle-bold-duotone"
                                ></fib-icon>`
                              : ""
                          }
                        </button>`,
                    )}
                  </div>`
                : ""
            }
          </div>`;

    return html`<div class="rounded-[14px] border border-line bg-card p-[13px]">
      ${header}${body}
    </div>`;
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
