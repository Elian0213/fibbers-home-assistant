/* ================================================================== *
 * fibbers-media — media_player: now-playing with a drift-corrected seek bar,
 * transport, volume, source chips, optional speaker `group:` (join/unjoin) and
 * `favourites:` (play_media). `compact: true` is the tight now-playing row.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t } from "../i18n.js";
import { twSheet } from "../tw.js";
import { sliderTrack, overflowChips, SliderHold } from "../ui.js";
import { pctFromX, pickEntity } from "../util.js";
import "../icon.js";

const fmtTime = (s) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

const VIDEO_TYPES = ["tvshow", "movie", "video", "channel", "episode"];
const VIDEO_APPS =
  /netflix|youtube|plex|kodi|disney|hbo|prime|twitch|jellyfin/i;

// "on" (a TV powered on but playing nothing) and "unknown" (integration reload,
// pre-first-poll) both mean "nothing to show" — not "playing".
const IDLE_STATES = ["off", "idle", "standby", "unavailable", "unknown", "on"];

export class FibbersMedia extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _dragging: { state: true },
    _dragVol: { state: true },
    _seeking: { state: true },
    _dragSeek: { state: true },
    _srcOpen: { state: true },
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
      type: "custom:fibbers-media",
      entity: pickEntity(
        "media_player",
        entities,
        entitiesFallback,
        "media_player.example",
      ),
    };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("fibbers-media: `entity` (a media_player.*) is required");
    }
    if (
      config.sources != null &&
      config.sources !== "auto" &&
      !Array.isArray(config.sources)
    ) {
      throw new Error('fibbers-media: `sources` must be "auto" or a list');
    }
    if (config.group != null && !Array.isArray(config.group)) {
      throw new Error("fibbers-media: `group` must be a list of media_players");
    }
    if (config.favourites != null && !Array.isArray(config.favourites)) {
      throw new Error("fibbers-media: `favourites` must be a list");
    }
    this._config = config;
    this._dragging = false;
    this._dragVol = 0;
    this._seeking = false;
    this._dragSeek = 0;
    this._srcOpen = false;
    this._volHold = new SliderHold(this, { tolerance: 2 });
    this._seekHold = new SliderHold(this, { tolerance: 2, timeout: 5000 });
  }

  // A seek bar showing live elapsed time needs its own 1s tick while playing —
  // hass only pushes a new media_position occasionally.
  updated() {
    const p = this._pos();
    if (this._playing() && p && p.dur) this._startTick();
    else this._stopTick();
  }
  _startTick() {
    if (this._tick) return;
    this._tick = setInterval(() => this.requestUpdate(), 1000);
  }
  _stopTick() {
    if (this._tick) {
      clearInterval(this._tick);
      this._tick = null;
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopTick();
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
    return !st || IDLE_STATES.includes(st.state);
  }
  _vol() {
    const st = this._st();
    const v = st && st.attributes.volume_level;
    const entityVol = v != null ? Math.round(v * 100) : 0;
    return this._volHold.value(entityVol, {
      dragging: this._dragging,
      dragValue: this._dragVol,
      gone: this._idle(),
    });
  }

  // Current playback position with drift correction: media_position is a snapshot
  // taken at media_position_updated_at, so while playing we add the elapsed wall
  // time rather than letting the bar sit still between state pushes.
  _pos() {
    const a = (this._st() && this._st().attributes) || {};
    const base = Number(a.media_position);
    if (!Number.isFinite(base)) return null;
    const dur = Number(a.media_duration) || 0;
    let pos = base;
    if (this._playing() && a.media_position_updated_at) {
      const upd = Date.parse(a.media_position_updated_at);
      if (!isNaN(upd)) pos = base + (Date.now() - upd) / 1000;
    }
    return { pos: Math.max(0, dur ? Math.min(dur, pos) : pos), dur };
  }

  // Fallback tile icon (when there's no artwork): video for TV apps/content, else
  // a music note — so a TV playing Netflix doesn't show a music note.
  _contentIcon() {
    const a = (this._st() && this._st().attributes) || {};
    if (
      VIDEO_TYPES.includes(a.media_content_type) ||
      VIDEO_APPS.test(a.app_name || "")
    )
      return "solar:tv-bold-duotone";
    return "solar:music-note-bold-duotone";
  }

  // The full source list: explicit `sources`, or `auto` from source_list.
  _allSources() {
    const cfg = this._config;
    if (!cfg.sources) return [];
    const a = (this._st() && this._st().attributes) || {};
    return cfg.sources === "auto"
      ? (a.source_list || []).map((s) => ({ name: s, source: s }))
      : cfg.sources.map((s) =>
          typeof s === "string" ? { name: s, source: s } : s,
        );
  }

  _svc(service, data) {
    if (!this.hass) return Promise.resolve();
    return Promise.resolve(
      this.hass.callService("media_player", service, {
        entity_id: this._config.entity,
        ...data,
      }),
    );
  }
  // Hold the committed value on screen until the player reports it (no snap-back);
  // a failed call clears the hold instead of freezing on the optimistic value.
  _setVol(pct) {
    this._volHold.hold(pct);
    this._svc("volume_set", { volume_level: pct / 100 }).catch(() =>
      this._volHold.clear(),
    );
  }
  _seek(seconds) {
    this._seekHold.hold(seconds);
    this._svc("media_seek", { seek_position: Math.round(seconds) }).catch(() =>
      this._seekHold.clear(),
    );
  }

  _join(entityId) {
    if (this.hass)
      this.hass.callService("media_player", "join", {
        entity_id: this._config.entity,
        group_members: [entityId],
      });
  }
  _unjoin(entityId) {
    if (this.hass)
      this.hass.callService("media_player", "unjoin", { entity_id: entityId });
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
    this._setVol(v);
  }

  _seekFromX(e) {
    const dur = (this._pos() || {}).dur || 0;
    return (pctFromX(e.clientX, e.currentTarget) / 100) * dur;
  }
  _seekDown(e) {
    this._seeking = true;
    e.currentTarget.setPointerCapture &&
      e.currentTarget.setPointerCapture(e.pointerId);
    this._dragSeek = this._seekFromX(e);
  }
  _seekMove(e) {
    if (this._seeking) this._dragSeek = this._seekFromX(e);
  }
  _seekUp(e) {
    if (!this._seeking) return;
    const s = this._seekFromX(e);
    this._seeking = false;
    this._seek(s);
  }

  _transportBtn(icon, service, opts = {}) {
    const LABELS = {
      media_previous_track: "Previous track",
      media_play_pause: "Play / pause",
      media_next_track: "Next track",
    };
    const big = opts.big;
    return html`<button
      type="button"
      aria-label=${LABELS[service] || service}
      class="fib-hit flex ${big ? "h-11 w-11" : "h-9 w-9"} items-center justify-center rounded-full
             ${opts.accent ? "bg-accentbg text-accent" : "bg-card2 text-ink"}
             transition-transform active:scale-90"
      @click=${() => this._svc(service)}
    >
      <fib-icon
        class="${
          big
            ? "h-6 w-6 [--mdc-icon-size:24px]"
            : "h-[18px] w-[18px] [--mdc-icon-size:18px]"
        }"
        icon=${icon}
      ></fib-icon>
    </button>`;
  }

  _seekBar() {
    const p = this._pos();
    if (!p || !p.dur) return "";
    const pos = this._seekHold.value(p.pos, {
      dragging: this._seeking,
      dragValue: this._dragSeek,
      gone: this._idle(),
    });
    const pct = p.dur ? (pos / p.dur) * 100 : 0;
    return html`<div class="mb-3">
      ${sliderTrack({
        pct,
        label: "Seek",
        value: Math.round(pos),
        min: 0,
        max: Math.round(p.dur),
        step: 10,
        valueText: fmtTime(pos),
        onInput: (v) => this._seek(v),
        onDown: this._seekDown,
        onMove: this._seekMove,
        onUp: this._seekUp,
        onCancel: () => {
          this._seeking = false;
        },
      })}
      <div
        class="mt-1 flex justify-between text-[10px] tabular-nums text-muted"
      >
        <span>${fmtTime(pos)}</span>
        <span>-${fmtTime(p.dur - pos)}</span>
      </div>
    </div>`;
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
      : a.media_title || a.app_name || a.source || cfg.name || a.friendly_name;
    const artist = idle ? "" : a.media_artist || a.app_name || "";
    const art = a.entity_picture; // media_image_url is a Python property, never a state attr
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
              icon=${this._contentIcon()}
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
        ${this._transportBtn(playIcon, "media_play_pause", { accent: true })}
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

      ${this._seekBar()}

      <div class="mb-3 flex items-center justify-center gap-4">
        ${this._transportBtn(
          "solar:skip-previous-bold-duotone",
          "media_previous_track",
        )}
        ${this._transportBtn(playIcon, "media_play_pause", {
          big: true,
          accent: true,
        })}
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
          label: "Volume",
          value: this._vol(),
          min: 0,
          max: 100,
          step: 5,
          valueText: `${this._vol()}%`,
          onInput: (v) => this._setVol(v),
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

      ${(() => {
        const all = this._allSources();
        if (!all.length) return "";
        const collapsed = all.length > 8 ? all.slice(0, 8) : null;
        return html`<div class="mt-3">
          ${overflowChips({
            hl,
            all,
            collapsed,
            activeValue: a.source,
            open: this._srcOpen,
            onToggle: () => {
              this._srcOpen = !this._srcOpen;
            },
            onSelect: (s) =>
              this._svc("select_source", { source: s.source || s.name }),
          })}
        </div>`;
      })()}
      ${this._groupRow(a)} ${this._favouritesGrid()}
    </div>`;
  }

  _groupRow(a) {
    const cfg = this._config;
    if (!Array.isArray(cfg.group) || !cfg.group.length) return "";
    const hl = cfg.language || this.hass;
    const members = a.group_members || [];
    return html`<div class="mt-3">
      <div
        class="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
      >
        ${t(hl, "media.speakers")}
      </div>
      <div class="flex flex-wrap gap-1.5">
        ${cfg.group.map((g) => {
          const gid = typeof g === "string" ? g : g.entity;
          const gname =
            (typeof g === "object" && g.name) ||
            (this.hass &&
              this.hass.states[gid] &&
              this.hass.states[gid].attributes.friendly_name) ||
            gid;
          const joined = members.includes(gid);
          return html`<button
            type="button"
            aria-label=${gname}
            aria-pressed=${joined ? "true" : "false"}
            class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[5px]
                   text-[10.5px] font-medium ${
                     joined
                       ? "border-accentline bg-accentbg text-accent"
                       : "border-line bg-card2 text-ink2"
                   }"
            @click=${() => (joined ? this._unjoin(gid) : this._join(gid))}
          >
            <fib-icon
              class="h-[13px] w-[13px] [--mdc-icon-size:13px]"
              icon="solar:speaker-bold-duotone"
            ></fib-icon>
            ${gname}
          </button>`;
        })}
      </div>
    </div>`;
  }

  _favouritesGrid() {
    const favs = this._config.favourites;
    if (!Array.isArray(favs) || !favs.length) return "";
    return html`<div class="mt-3 grid grid-cols-4 gap-2">
      ${favs.map(
        (f) =>
          html`<button
            type="button"
            aria-label=${f.name || f.media_content_id}
            class="flex flex-col items-center gap-1 text-[10px] text-ink2"
            @click=${() =>
              this._svc("play_media", {
                media_content_id: f.media_content_id,
                media_content_type: f.media_content_type || "music",
              })}
          >
            <div
              class="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[10px]
                   bg-card2 bg-cover bg-center"
              style=${f.thumbnail ? `background-image:url("${f.thumbnail}")` : ""}
            >
              ${
                f.thumbnail
                  ? ""
                  : html`<fib-icon
                      class="h-5 w-5 [--mdc-icon-size:20px] text-muted"
                      icon=${f.icon || "solar:play-bold-duotone"}
                    ></fib-icon>`
              }
            </div>
            <span class="w-full truncate text-center">${f.name || ""}</span>
          </button>`,
      )}
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
