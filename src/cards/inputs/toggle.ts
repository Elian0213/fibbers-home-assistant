/* ================================================================== *
 * fibbers-toggle — switch row for input_boolean/switch/automation (shared pill).
 * Optional `secondary`/`secondary_entity` subline and `confirm` guard.
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { t } from "@shared/i18n";
import { twSheet } from "@shared/tw";
import { pillSwitch } from "@shared/ui";
import { fmtState, pickEntity } from "@shared/util";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
} from "@/types/home-assistant";
import "@shared/icon";

/** YAML/editor config accepted by `fibbers-toggle`. */
export interface ToggleConfig extends LovelaceCardConfig {
  entity: string;
  name?: string;
  icon?: string;
  secondary?: string;
  secondary_entity?: string;
  confirm?: boolean;
  language?: string;
}

const EDITOR_SCHEMA = [
  { name: "entity", selector: { entity: {} } },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
  { name: "secondary", selector: { text: {} } },
  { name: "secondary_entity", selector: { entity: {} } },
  { name: "confirm", selector: { boolean: {} } },
];

/**
 * fibbers-toggle — switch row for input_boolean/switch/automation on a shared pill.
 * Optional `secondary`/`secondary_entity` subline and a `confirm` guard.
 */
@customElement("fibbers-toggle")
export class FibbersToggle extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config!: ToggleConfig;

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Seed config for the picker — an input_boolean entity from the dashboard, or a placeholder. */
  static getStubConfig(
    _hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[],
  ): ToggleConfig {
    return {
      type: "custom:fibbers-toggle",
      entity: pickEntity(
        "input_boolean",
        entities,
        entitiesFallback,
        "input_boolean.example",
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

  /** Validate + store the config; throws when `entity` is missing (any domain is accepted). */
  setConfig(config: ToggleConfig): void {
    if (!config || !config.entity) {
      throw new Error("fibbers-toggle: `entity` is required");
    }
    this.config = config;
  }

  private _st(): HassEntity | undefined {
    return this.hass && this.hass.states[this.config.entity];
  }

  private _toggle(): void {
    if (!this.hass) return;
    const cfg = this.config;
    if (cfg.confirm && !window.confirm(`${cfg.name || cfg.entity}?`)) return;
    this.hass.callService("homeassistant", "toggle", { entity_id: cfg.entity });
  }

  private _secondary(): string {
    const { hass } = this;
    const cfg = this.config;
    if (cfg.secondary) return cfg.secondary;
    if (cfg.secondary_entity && hass) {
      const s = hass.states[cfg.secondary_entity];
      return s ? fmtState(hass, s) : "";
    }
    return "";
  }

  /** Render the icon, name, optional subline, and the toggle pill. */
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
    const on = st.state === "on";
    const name = cfg.name || st.attributes.friendly_name || cfg.entity;
    const icon = cfg.icon || st.attributes.icon || "solar:power-bold-duotone";
    const sub = this._secondary();

    return html`<div
      class="flex items-center gap-2.5 rounded-[14px] border border-line bg-card p-[13px]"
    >
      <div
        class="flex h-8 w-8 flex-none items-center justify-center rounded-lg
               ${on ? "bg-accentbg text-accent" : "bg-card2 text-muted"}"
      >
        <fib-icon
          class="h-[18px] w-[18px] [--mdc-icon-size:18px]"
          icon=${icon}
        ></fib-icon>
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-[12px] font-medium text-ink">${name}</div>
        ${
          sub
            ? html`<div class="truncate text-[10.5px] text-muted">${sub}</div>`
            : ""
        }
      </div>
      ${pillSwitch({ on, onClick: () => this._toggle(), label: name })}
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
