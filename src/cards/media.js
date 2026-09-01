/* ================================================================== *
 * fibbers-media — media_player: now-playing, transport, drag volume, and
 * optional `sources` chips. `compact: true` is the tight "Nu bezig" row.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t } from "../i18n.js";
import { twSheet } from "../tw.js";
import { sliderTrack } from "../ui.js";
import { pctFromX } from "../util.js";
import "../icon.js";

export class FibbersMedia extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _dragging: { state: true },
    _dragVol: { state: true },
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
      type: "custom:fibbers-media",
      entity: "media_player.woonkamer_spotify",
    };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("fibbers-media: `entity` (a media_player.*) is required");
    }
    if (config.sources != null && !Array.isArray(config.sources)) {
      throw new Error("fibbers-media: `sources` must be a list");
    }
    this._config = config;
    this._dragging = false;
    this._dragVol = 0;
  }

  _st() {
    return this.hass && this.hass.states[this._config.entity];
  }
  _playing() {
    const st = this._st();
    return st && st.state === "playing";
  }
  _idle() {
    const st = this._st();
    return !st || ["off", "idle", "standby", "unavailable"].includes(st.state);
  }
  _vol() {
    if (this._dragging) return this._dragVol;
    const st = this._st();
    const v = st && st.attributes.volume_level;
    return v != null ? Math.round(v * 100) : 0;
  }

  _svc(service, data) {
    if (this.hass)
      this.hass.callService("media_player", service, {
        entity_id: this._config.entity,
        ...data,
      });
  }

  _down(e) {
    this._dragging = true;
    e.currentTarget.setPointerCapture &&
      e.currentTarget.setPointerCapture(e.pointerId);
    this._dragVol = Math.round(pctFromX(e.clientX, e.currentTarget));
  }
  _move(e) {
    if (this._dragging)
      this._dragVol = Math.round(pctFromX(e.clientX, e.currentTarget));
  }
  _up(e) {
    if (!this._dragging) return;
    const v = Math.round(pctFromX(e.clientX, e.currentTarget));
    this._dragging = false;
    this._svc("volume_set", { volume_level: v / 100 });
  }

  _transportBtn(icon, service, big = false) {
    return html`<button
      type="button"
      class="flex ${big ? "h-11 w-11" : "h-9 w-9"} items-center justify-center rounded-full
             bg-card2 text-ink transition-transform active:scale-90"
      @click=${() => this._svc(service)}
    >
      <fib-icon
        class="${big ? "h-6 w-6 [--mdc-icon-size:24px]" : "h-[18px] w-[18px] [--mdc-icon-size:18px]"}"
        icon=${icon}
      ></fib-icon>
    </button>`;
  }

  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const st = this._st();
    const a = (st && st.attributes) || {};
    const idle = this._idle();
    const title = idle
      ? t(hl, "media.idle")
      : a.media_title ||
        a.friendly_name ||
        cfg.name ||
        t(hl, "media.default_name");
    const artist = idle ? "" : a.media_artist || a.app_name || "";
    const art = a.entity_picture || a.media_image_url;
    const playIcon = this._playing()
      ? "solar:pause-bold-duotone"
      : "solar:play-bold-duotone";

    const artBox = html`<div
      class="flex ${cfg.compact ? "h-11 w-11" : "h-14 w-14"} flex-none items-center
             justify-center overflow-hidden rounded-xl bg-card2 bg-cover bg-center"
      style=${art ? `background-image:url("${art}")` : ""}
    >
      ${
        art
          ? ""
          : html`<fib-icon
              class="h-6 w-6 [--mdc-icon-size:24px] text-muted"
              icon="solar:music-note-bold-duotone"
            ></fib-icon>`
      }
    </div>`;

    if (cfg.compact) {
      return html`<div
        class="flex items-center gap-3 rounded-[14px] border border-line bg-card p-3"
      >
        ${artBox}
        <div class="min-w-0 flex-1">
          <div class="truncate text-[13px] font-semibold text-ink">
            ${title}
          </div>
          <div class="truncate text-[11px] text-muted">${artist}</div>
        </div>
        ${this._transportBtn(playIcon, "media_play_pause")}
        ${this._transportBtn("solar:skip-next-bold-duotone", "media_next_track")}
      </div>`;
    }

    return html`<div class="rounded-[14px] border border-line bg-card p-[13px]">
      <div class="mb-3 flex items-center gap-3">
        ${artBox}
        <div class="min-w-0 flex-1">
          ${
            cfg.name
              ? html`<div
                  class="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted"
                >
                  ${cfg.name}
                </div>`
              : ""
          }
          <div class="truncate text-[15px] font-semibold text-ink">
            ${title}
          </div>
          <div class="truncate text-[12px] text-muted">${artist}</div>
        </div>
      </div>

      <div class="mb-3 flex items-center justify-center gap-4">
        ${this._transportBtn(
          "solar:skip-previous-bold-duotone",
          "media_previous_track",
        )}
        ${this._transportBtn(playIcon, "media_play_pause", true)}
        ${this._transportBtn("solar:skip-next-bold-duotone", "media_next_track")}
      </div>

      <div class="mb-1 flex items-center gap-2.5">
        <fib-icon
          class="h-4 w-4 flex-none [--mdc-icon-size:16px] text-muted"
          icon="solar:volume-small-bold-duotone"
        ></fib-icon>
        ${sliderTrack({
          pct: this._vol(),
          cls: "flex-1",
          onDown: this._down,
          onMove: this._move,
          onUp: this._up,
          onCancel: () => {
            this._dragging = false;
          },
        })}
        <fib-icon
          class="h-4 w-4 flex-none [--mdc-icon-size:16px] text-muted"
          icon="solar:volume-loud-bold-duotone"
        ></fib-icon>
      </div>

      ${
        Array.isArray(cfg.sources) && cfg.sources.length
          ? html`<div class="mt-3 flex flex-wrap gap-[7px]">
              ${cfg.sources.map((s) => {
                const active =
                  st && st.attributes.source === (s.source || s.name);
                return html`<button
                  type="button"
                  class="inline-flex items-center rounded-full border px-2.5 py-[5px] text-[10.5px]
                       font-medium ${
                         active
                           ? "border-accentline bg-accentbg text-accent"
                           : "border-line bg-card2 text-ink2"
                       }"
                  @click=${() =>
                    this._svc("select_source", { source: s.source || s.name })}
                >
                  ${s.name}
                </button>`;
              })}
            </div>`
          : ""
      }
    </div>`;
  }

  getCardSize() {
    return 3;
  }
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 3 };
  }
  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }
}
