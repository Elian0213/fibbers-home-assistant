/* ================================================================== *
 * CARD — fibbers-chips  (Lit + Tailwind)
 *
 * A pill row. Each chip carries a standard HA action object; an optional
 * `active_when: {entity, state}` gives it a blue tint while that state holds.
 * ================================================================== */
import { LitElement, html, css } from "lit";
import { twSheet } from "../tw.js";
import { runAction } from "../actions.js";
import "../icon.js";

export class FibbersChips extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
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
      type: "custom:fibbers-chips",
      chips: [
        {
          name: "Alles uit",
          icon: "solar:power-bold-duotone",
          action: { action: "toggle" },
        },
      ],
    };
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.chips)) {
      throw new Error("fibbers-chips: `chips` must be a list");
    }
    this._config = config;
  }

  _active(chip) {
    const aw = chip.active_when;
    if (!aw || !aw.entity || !this.hass) return false;
    const st = this.hass.states[aw.entity];
    return !!(
      st && (aw.state != null ? st.state === aw.state : st.state === "on")
    );
  }

  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    return html`<div class="flex flex-wrap gap-[7px]">
      ${cfg.chips.map((chip) => {
        const active = this._active(chip);
        return html`<button
          type="button"
          class="inline-flex items-center gap-[5px] rounded-full border px-2.5 py-[5px]
                 text-[10.5px] font-medium
                 ${
                   active
                     ? "border-blueline bg-bluebg text-blueink"
                     : "border-line bg-card2 text-ink2"
                 }"
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

  getCardSize() {
    return 1;
  }
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
}
