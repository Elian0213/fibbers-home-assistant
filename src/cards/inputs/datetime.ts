/* ================================================================== *
 * fibbers-datetime — input_datetime shown big and legible (not an ISO string);
 * handles has_date/has_time. Tap opens more-info to edit (no custom picker).
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { cardShell, unavailNotice } from "@shared/shells";
import { twSheet } from "@shared/tw";
import { moreInfo, fmtState, pickEntity } from "@shared/util";
import { cx, sectionLabel } from "@shared/variants";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
} from "@/types/home-assistant";
import "@shared/icon";

// Only a real HH:MM prefix, so "unavailable" falls through to "—".
const hhmm = (s: string | null | undefined): string => {
  const m = typeof s === "string" && s.match(/^(\d{2}:\d{2})/);
  return m ? m[1] : "";
};

const EDITOR_SCHEMA = [
  { name: "entity", selector: { entity: {} } },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
];

/** YAML/editor config accepted by `fibbers-datetime`. */
export interface DateTimeConfig extends LovelaceCardConfig {
  entity: string;
  name?: string;
  icon?: string;
  language?: string;
}

/**
 * fibbers-datetime — input_datetime shown big and legible (not an ISO string);
 * handles has_date/has_time. Tap opens more-info to edit (no custom picker).
 */
@customElement("fibbers-datetime")
export class FibbersDateTime extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config!: DateTimeConfig;

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Seed config for the picker — an input_datetime entity from the dashboard, or a placeholder. */
  static getStubConfig(
    _hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[],
  ): DateTimeConfig {
    return {
      type: "custom:fibbers-datetime",
      entity: pickEntity(
        "input_datetime",
        entities,
        entitiesFallback,
        "input_datetime.example",
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

  /** Validate + store the config; throws when `entity` is missing. */
  setConfig(config: DateTimeConfig): void {
    if (!config || !config.entity) {
      throw new Error("fibbers-datetime: `entity` is required");
    }
    this.config = config;
  }

  private _st(): HassEntity | undefined {
    return this.hass && this.hass.states[this.config.entity];
  }

  // time-only → big HH:MM; otherwise HA's localised value (falls back to state).
  private _display(st: HassEntity): string {
    const a = st.attributes || {};
    if (a.has_time && !a.has_date) return hhmm(st.state) || "—";
    return fmtState(this.hass, st) || st.state || "—";
  }

  /** Render the label and the big tappable value that opens more-info. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const st = this._st();
    if (!st) return unavailNotice(hl);
    const name = cfg.name || st.attributes.friendly_name || cfg.entity;
    const icon =
      cfg.icon || st.attributes.icon || "solar:clock-circle-bold-duotone";
    const timeOnly = st.attributes.has_time && !st.attributes.has_date;
    const val = this._display(st);

    return cardShell(
      html`<div class="mb-1.5 flex items-center gap-2">
          <fib-icon
            class="h-4 w-4 [--mdc-icon-size:16px] text-accent"
            icon=${icon}
          ></fib-icon>
          <span class="${sectionLabel()}">${name}</span>
        </div>
        <button
          type="button"
          class="text-left"
          @click=${() => moreInfo(this, cfg.entity)}
        >
          <span
            class="${cx(
              "font-semibold leading-none text-ink",
              timeOnly ? "text-[30px]" : "text-[20px]",
            )}"
            >${val}</span
          >
        </button>`,
    );
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
