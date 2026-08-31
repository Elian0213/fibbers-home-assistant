/* ================================================================== *
 * CARD — fibbers-presence  (Lit + Tailwind)
 *
 * Who's home. A summary line ("Niemand thuis" / "2 thuis") over a row of
 * person tiles — avatar or icon, name, Thuis/Weg — tinted green when home.
 * `people` lists the entities, or it auto-collects every `person.*`.
 * ================================================================== */
import { LitElement, html, css } from "lit";
import { twSheet } from "../tw.js";
import "../icon.js";

export class FibbersPresence extends LitElement {
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
    return { type: "custom:fibbers-presence" };
  }

  setConfig(config) {
    if (config && config.people != null && !Array.isArray(config.people)) {
      throw new Error("fibbers-presence: `people` must be a list of entities");
    }
    this._config = config || {};
  }

  _people() {
    if (Array.isArray(this._config.people)) return this._config.people;
    if (!this.hass) return [];
    return Object.keys(this.hass.states)
      .filter((id) => id.startsWith("person."))
      .sort();
  }
  _isHome(st) {
    return st && st.state === "home";
  }
  _stateLabel(st) {
    if (!st) return "—";
    if (st.state === "home") return "Thuis";
    if (st.state === "not_home") return "Weg";
    return st.state;
  }
  _moreInfo(entity) {
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: entity },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const people = this._people();
    const homeCount = people.filter((id) =>
      this._isHome(this.hass && this.hass.states[id]),
    ).length;

    return html`<div class="rounded-[14px] border border-line bg-card p-[13px]">
      <div class="mb-2.5 flex items-baseline justify-between gap-2">
        ${
          this._config.title === false
            ? ""
            : html`<span
                class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
                >Aanwezigheid</span
              >`
        }
        <span
          class="text-[12px] font-semibold ${
            homeCount === 0 ? "text-muted" : "text-ink"
          }"
          >${homeCount === 0 ? "Niemand thuis" : `${homeCount} thuis`}</span
        >
      </div>
      <div class="flex flex-wrap gap-2">
        ${people.map((id) => {
          const st = this.hass && this.hass.states[id];
          const home = this._isHome(st);
          const pic = st && st.attributes && st.attributes.entity_picture;
          return html`<button
            type="button"
            class="flex items-center gap-2 rounded-full border py-[7px] pl-[7px] pr-[11px]
                   ${
                     home
                       ? "border-accentline bg-accentbg"
                       : "border-line bg-card2"
                   }"
            @click=${() => this._moreInfo(id)}
          >
            <div
              class="flex h-[26px] w-[26px] flex-none items-center justify-center
                     overflow-hidden rounded-full bg-card bg-cover bg-center"
              style=${pic ? `background-image:url("${pic}")` : ""}
            >
              ${
                pic
                  ? ""
                  : html`<fib-icon
                      class="h-[15px] w-[15px] [--mdc-icon-size:15px] ${
                        home ? "text-accent" : "text-muted"
                      }"
                      icon="solar:user-bold-duotone"
                    ></fib-icon>`
              }
            </div>
            <div class="flex flex-col leading-[1.25]">
              <span class="text-[12px] font-semibold text-ink"
                >${
                  (st && st.attributes && st.attributes.friendly_name) ||
                  id.split(".")[1]
                }</span
              >
              <span class="text-[10px] ${home ? "text-accenttx" : "text-muted"}"
                >${this._stateLabel(st)}</span
              >
            </div>
          </button>`;
        })}
      </div>
    </div>`;
  }

  getCardSize() {
    return 1;
  }
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
}
