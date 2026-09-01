/* ================================================================== *
 * fibbers-select — option picker for input_select/select: a chip row for few
 * options, else a self-styled dropdown (never ha-select). Closes on outside-click.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t } from "../i18n.js";
import { twSheet } from "../tw.js";
import { pickEntity } from "../util.js";
import "../icon.js";

export class FibbersSelect extends LitElement {
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

  static getStubConfig(hass, entities, entitiesFallback) {
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

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("fibbers-select: `entity` is required");
    }
    this._config = config;
    this._open = false;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._removeOutside();
  }

  _st() {
    return this.hass && this.hass.states[this._config.entity];
  }
  _options() {
    const st = this._st();
    return (st && st.attributes && st.attributes.options) || [];
  }
  _current() {
    const st = this._st();
    return st ? st.state : "";
  }
  _select(opt) {
    if (this.hass) {
      const domain = this._config.entity.split(".")[0];
      this.hass.callService(domain, "select_option", {
        entity_id: this._config.entity,
        option: opt,
      });
    }
    this._close();
  }

  _openMenu() {
    this._removeOutside(); // drop any stale listener before re-opening
    this._open = true;
    this._outside = (e) => {
      if (!e.composedPath().includes(this)) this._close();
    };
    // defer so the opening click doesn't immediately close it
    setTimeout(() => document.addEventListener("click", this._outside), 0);
  }
  _close() {
    this._open = false;
    this._removeOutside();
  }
  _removeOutside() {
    if (this._outside) {
      document.removeEventListener("click", this._outside);
      this._outside = null;
    }
  }

  render() {
    const cfg = this._config;
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
    const mode =
      cfg.mode === "chips" || cfg.mode === "dropdown"
        ? cfg.mode
        : options.length <= max
          ? "chips"
          : "dropdown";

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
        ? html`<div class="flex flex-wrap gap-1.5">
            ${options.map((o) => {
              const active = o === current;
              return html`<button
                type="button"
                class="rounded-full border px-2.5 py-1 text-[10.5px] font-medium
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
                ? html`<div
                    class="absolute left-0 right-0 top-[calc(100%+4px)] z-10 max-h-[220px] overflow-auto
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
