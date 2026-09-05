/* ================================================================== *
 * fibbers-section — the uppercase mono section label.
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";

import { twSheet } from "@shared/tw";
import type {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
} from "@/types/home-assistant";

/** YAML/editor config accepted by `fibbers-section`. */
export interface SectionConfig extends LovelaceCardConfig {
  label: string;
}

const EDITOR_SCHEMA = [{ name: "label", selector: { text: {} } }];

/** fibbers-section — uppercase mono divider label between stacks of cards. */
@customElement("fibbers-section")
export class FibbersSection extends LitElement implements LovelaceCard {
  @state() private config!: SectionConfig;

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Starter config for the card picker. */
  static getStubConfig(): SectionConfig {
    return { type: "custom:fibbers-section", label: "Section" };
  }

  /** Return the shared form editor, wired to this card's schema. */
  static getConfigElement(): LovelaceCardEditor {
    const el = document.createElement(
      "fibbers-form-editor",
    ) as LovelaceCardEditor & {
      schema?: unknown;
    };
    el.schema = EDITOR_SCHEMA;
    return el;
  }

  /** Require a `label` and store the config. */
  setConfig(config: SectionConfig): void {
    if (!config || !config.label) {
      throw new Error("fibbers-section: `label` is required");
    }
    this.config = config;
  }

  /** No-op — a static label needs no state. */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  set hass(_hass: HomeAssistant | undefined) {}

  /** The uppercase mono label. */
  render(): TemplateResult {
    if (!this.config) return html``;
    return html`<div
      class="px-0.5 pt-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.11em] text-muted"
    >
      ${this.config.label}
    </div>`;
  }

  /** One masonry row. */
  getCardSize(): number {
    return 1;
  }

  /** Full-width, single-row footprint in the sections/grid layout. */
  getLayoutOptions(): { grid_columns: string; grid_rows: number } {
    return { grid_columns: "full", grid_rows: 1 };
  }

  /** Span the full grid width; height follows content. */
  getGridOptions(): { columns: string; rows: string } {
    return { columns: "full", rows: "auto" };
  }
}
