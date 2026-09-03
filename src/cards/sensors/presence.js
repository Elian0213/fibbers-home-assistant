/* ================================================================== *
 * fibbers-presence — "who's home" summary over person tiles (home/away, green
 * when home). `people` lists them, or it auto-collects every `person.*`.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t } from "../../shared/i18n.js";
import { twSheet } from "../../shared/tw.js";
import { moreInfo, cssUrl } from "../../shared/util.js";
import "../../shared/icon.js";

/**
 * fibbers-presence — "who's home" summary over person tiles (home/away, green
 * when home). `people` lists them, or it auto-collects every `person.*`.
 */
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

  /** Seed config for the card picker — no config needed, it auto-collects people. */
  static getStubConfig() {
    return { type: "custom:fibbers-presence" };
  }

  /** Store the config; throws when `people` is present but not a list so the editor surfaces it. */
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
    const hl = this._config.language || this.hass;
    if (!st) return "—";
    if (st.state === "home") return t(hl, "presence.home");
    if (st.state === "not_home") return t(hl, "presence.away");
    return st.state;
  }
  _moreInfo(entity) {
    moreInfo(this, entity);
  }

  /** Render the home-count header and a wrapped row of tappable person tiles. */
  render() {
    const people = this._people();
    const hl = this._config.language || this.hass;
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
                >${t(hl, "presence.title")}</span
              >`
        }
        <span
          class="text-[12px] font-semibold ${
            homeCount === 0 ? "text-muted" : "text-ink"
          }"
          >${homeCount === 0 ? t(hl, "presence.nobody_home") : t(hl, "presence.count_home", { n: homeCount })}</span
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
              style=${pic ? `background-image:${cssUrl(pic)}` : ""}
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

  /** Masonry height in rows. */
  getCardSize() {
    return 1;
  }
  /** Legacy sections-view sizing (grid_columns/grid_rows). */
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
  /** Current sections-view sizing — full width, auto height. */
  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }
}
