/* ================================================================== *
 * fibbers-chips — a pill row; each chip runs an HA action, with an optional
 * `active_when: {entity, state}` blue tint.
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { runAction, type ActionConfig } from "@shared/actions";
import { twSheet } from "@shared/tw";
import { cx } from "@shared/variants";
import type {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
} from "@/types/home-assistant";
import "@shared/icon";

/** A single chip in a `fibbers-chips` row. */
export interface ChipConfig {
  name?: string;
  icon?: string;
  entity?: string;
  action?: ActionConfig;
  tap_action?: ActionConfig;
  active_when?: { entity?: string; state?: string };
}

/** YAML/editor config accepted by `fibbers-chips`. */
export interface ChipsConfig extends LovelaceCardConfig {
  chips: ChipConfig[];
}

/**
 * fibbers-chips — a pill row; each chip runs an HA action, with an optional
 * `active_when: {entity, state}` blue tint.
 */
@customElement("fibbers-chips")
export class FibbersChips extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config!: ChipsConfig;

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Seed config with one example chip — this card takes an action list, not a single entity. */
  static getStubConfig(): ChipsConfig {
    return {
      type: "custom:fibbers-chips",
      chips: [
        {
          name: "All off",
          icon: "solar:power-bold-duotone",
          action: { action: "toggle" },
        },
      ],
    };
  }

  /** Validate + store the config; throws when `chips` isn't a list. */
  setConfig(config: ChipsConfig): void {
    if (!config || !Array.isArray(config.chips)) {
      throw new Error("fibbers-chips: `chips` must be a list");
    }
    this.config = config;
  }

  private _active(chip: ChipConfig): boolean {
    const aw = chip.active_when;
    if (!aw || !aw.entity || !this.hass) return false;
    const st = this.hass.states[aw.entity];
    return !!(
      st && (aw.state != null ? st.state === aw.state : st.state === "on")
    );
  }

  /** Render the chip row; each chip tints when its `active_when` matches. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    return html`<div class="flex flex-wrap gap-x-2 gap-y-[18px]">
      ${cfg.chips.map((chip) => {
        const active = this._active(chip);
        return html`<button
          type="button"
          aria-label=${chip.name || chip.entity || "action"}
          class="${cx(
            "fib-hit inline-flex items-center gap-[5px] rounded-full border px-2.5 py-[5px] text-[10.5px] font-medium",
            active
              ? "border-blueline bg-bluebg text-blueink"
              : "border-line bg-card2 text-ink2",
          )}"
          @click=${() =>
            this.hass &&
            runAction(
              chip.action || chip.tap_action,
              this.hass,
              this,
              chip.entity,
            )}
        >
          ${
            chip.icon
              ? html`<fib-icon
                  class="h-[13px] w-[13px] [--mdc-icon-size:13px]"
                  icon=${chip.icon}
                ></fib-icon>`
              : ""
          }
          <span>${chip.name || ""}</span>
        </button>`;
      })}
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
