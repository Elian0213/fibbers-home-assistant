/* ================================================================== *
 * fibbers-media — media_player: now-playing with a drift-corrected seek bar,
 * transport, volume, source chips, optional speaker `group:` (join/unjoin) and
 * `favourites:` (play_media). `compact: true` is the tight now-playing row.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t } from "../../shared/i18n.js";
import { twSheet } from "../../shared/tw.js";
import { sliderTrack, overflowChips, SliderHold } from "../../shared/ui.js";
import { pctFromX, pickEntity, cssUrl, debounce } from "../../shared/util.js";
import "../../shared/icon.js";

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

// MediaPlayerEntityFeature bits (HA core) — only render a control the player
// actually advertises, so a CEC TV with no volume doesn't show a dead slider.
const MF = {
  PAUSE: 1,
  SEEK: 2,
  VOLUME_SET: 4,
  PREV: 16,
  NEXT: 32,
  SELECT_SOURCE: 2048,
  PLAY: 16384,
  GROUPING: 524288,
};

/**
 * fibbers-media — a media_player card: drift-corrected seek bar, transport, volume,
 * source chips, optional speaker `group:` (join/unjoin) and `favourites:`
 * (play_media). `compact: true` renders the tight now-playing row.
 */
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

  /** HA calls this to seed a fresh card — pick a real media_player so the default isn't empty. */
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

  /** Validate + store the config; throws on a bad entity/sources/group so the editor surfaces it. */
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
    // Construct the holds once — addController has no counterpart, so a fresh pair
    // per setConfig (per editor keystroke) would orphan controllers.
    if (!this._volHold) {
      this._volHold = new SliderHold(this, { tolerance: 2 });
      this._seekHold = new SliderHold(this, { tolerance: 2, timeout: 5000 });
    } else {
      this._volHold.clear();
      this._seekHold.clear();
    }
    // Keyboard nudges on the sliders shouldn't fire a service call per keydown.
    this._volInput = debounce((v) => this._setVol(v), 150);
    this._seekInput = debounce((v) => this._seek(v), 150);
  }

  /**
   * Drive the 1s seek tick and clear stale seek/hold state — hass only pushes a
   * new media_position occasionally, so a live elapsed bar needs its own clock.
   */
  updated() {
    if (!this._config) return;
    const p = this._pos();
    if (this._playing() && p && p.dur) this._startTick();
    else this._stopTick();
    // The seek bar is gone (playback stopped / no duration) but a drag was still
    // in progress — clear it so a stale _seeking doesn't wedge the next render.
    if (this._seeking && !(p && p.dur)) this._seeking = false;
    // Clear the post-seek hold as soon as the player reports a fresh position
    // (its updated-at moved), instead of waiting on the tolerance/timeout — seek
    // targets drift with playback and may never match within tolerance.
    const upd =
      (this._st() && this._st().attributes.media_position_updated_at) || null;
    if (this._seekAt != null && upd !== this._seekAt) {
      this._seekAt = null;
      this._seekHold.clear();
    }
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
  /** Stop the tick and drop trailing debounced writes on unmount. */
  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopTick();
    this._volInput.cancel();
    this._seekInput.cancel();
  }

  _st() {
    return this.hass && this.hass.states[this._config.entity];
  }
  _playing() {
    const st = this._st();
    return st && st.state === "playing";
  }
  // Does the player advertise this MediaPlayerEntityFeature bit? A missing
  // supported_features (integration reload / off) reads as 0 → nothing offered.
  _supports(bit) {
    const st = this._st();
    const f = (st && st.attributes.supported_features) || 0;
    return (f & bit) === bit;
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
    // Remember the position timestamp at seek time; the hold clears once the
    // player pushes a newer one (see updated()).
    this._seekAt =
      (this._st() && this._st().attributes.media_position_updated_at) || null;
    this._svc("media_seek", { seek_position: Math.round(seconds) }).catch(() =>
      this._seekHold.clear(),
    );
  }

  // Fire-and-forget media_player call — swallow the rejection so a call HA refuses
  // (an ungated control the player can't actually run) isn't an unhandled rejection.
  _do(service, data) {
    this._svc(service, data).catch(() => {});
  }

  _join(entityId) {
    if (!this.hass) return;
    this.hass
      .callService("media_player", "join", {
        entity_id: this._config.entity,
        group_members: [entityId],
      })
      .catch(() => {});
  }
  _unjoin(entityId) {
    if (!this.hass) return;
    this.hass
      .callService("media_player", "unjoin", { entity_id: entityId })
      .catch(() => {});
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
      @click=${() => this._do(service)}
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

  _seekBar(hl) {
    const p = this._pos();
    if (!p || !p.dur) return "";
    const pos = this._seekHold.value(p.pos, {
      dragging: this._seeking,
      dragValue: this._dragSeek,
      gone: this._idle(),
    });
    const pct = p.dur ? (pos / p.dur) * 100 : 0;
    const times = html`<div
      class="mt-1 flex justify-between text-[10px] tabular-nums text-muted"
    >
      <span>${fmtTime(pos)}</span>
      <span>-${fmtTime(p.dur - pos)}</span>
    </div>`;
    // No SEEK support: show the position as a read-only progress bar (fill only, no
    // knob or handlers) rather than hiding it — many players report position but
    // can't seek.
    if (!this._supports(MF.SEEK)) {
      return html`<div class="mb-3">
        <div class="h-1.5 w-full rounded-[3px] bg-[#2C3639]">
          <div
            class="h-full rounded-[3px] bg-accent"
            style="width:${pct}%"
          ></div>
        </div>
        ${times}
      </div>`;
    }
    return html`<div class="mb-3">
      ${sliderTrack({
        pct,
        label: t(hl, "media.seek"),
        value: Math.round(pos),
        min: 0,
        max: Math.round(p.dur),
        step: 10,
        valueText: fmtTime(pos),
        // Arm the hold optimistically so repeated key presses advance the bar —
        // otherwise `value` is read back from the (unchanged) entity each keydown
        // and the debounce discards all but the last: one step per HA round trip.
        onInput: (v) => {
          this._seekHold.hold(v);
          this._seekInput(v);
        },
        onDown: this._seekDown,
        onMove: this._seekMove,
        onUp: this._seekUp,
        onCancel: () => {
          this._seeking = false;
        },
      })}
      ${times}
    </div>`;
  }

  /** Draw the card — the compact now-playing row, or the full art/seek/transport/volume/sources stack. */
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
    const canPlay = this._supports(MF.PLAY) || this._supports(MF.PAUSE);
    const canPrev = this._supports(MF.PREV);
    const canNext = this._supports(MF.NEXT);
    // A player can advertise VOLUME_SET yet never report a level (CEC, androidtv
    // volume-only, Chromecast before it connects) — the slider would sit at 0% and
    // re-snap there after every hold. Gate on the actual level, not just the bit.
    const canVol = this._supports(MF.VOLUME_SET) && a.volume_level != null;

    const artBox = html`<div
      class="flex ${cfg.compact ? "h-11 w-11" : "h-14 w-14"} flex-none items-center
             justify-center overflow-hidden rounded-xl bg-card2 bg-cover bg-center"
      style=${art ? `background-image:${cssUrl(art)}` : ""}
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
        ${
          canPlay
            ? this._transportBtn(playIcon, "media_play_pause", { accent: true })
            : ""
        }
        ${
          canNext
            ? this._transportBtn(
                "solar:skip-next-bold-duotone",
                "media_next_track",
              )
            : ""
        }
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

      ${this._seekBar(hl)}
      ${
        canPrev || canPlay || canNext
          ? html`<div class="mb-3 flex items-center justify-center gap-4">
              ${
                canPrev
                  ? this._transportBtn(
                      "solar:skip-previous-bold-duotone",
                      "media_previous_track",
                    )
                  : ""
              }
              ${
                canPlay
                  ? this._transportBtn(playIcon, "media_play_pause", {
                      big: true,
                      accent: true,
                    })
                  : ""
              }
              ${
                canNext
                  ? this._transportBtn(
                      "solar:skip-next-bold-duotone",
                      "media_next_track",
                    )
                  : ""
              }
            </div>`
          : ""
      }
      ${
        canVol
          ? html`<div class="mb-1 flex items-center gap-2.5">
              <fib-icon
                class="h-4 w-4 flex-none [--mdc-icon-size:16px] text-muted"
                icon="solar:volume-small-bold-duotone"
              ></fib-icon>
              ${sliderTrack({
                pct: this._vol(),
                cls: "flex-1",
                label: t(hl, "media.volume"),
                value: this._vol(),
                min: 0,
                max: 100,
                step: 5,
                valueText: `${this._vol()}%`,
                // Arm the hold so keyboard steps accumulate (see the seek bar).
                onInput: (v) => {
                  this._volHold.hold(v);
                  this._volInput(v);
                },
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
            </div>`
          : ""
      }
      ${(() => {
        // Gate on SELECT_SOURCE: a player that lists sources it can't switch to
        // shouldn't render chips whose calls HA rejects.
        const all = this._allSources();
        if (!all.length || !this._supports(MF.SELECT_SOURCE)) return "";
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
              this._do("select_source", { source: s.source || s.name }),
          })}
        </div>`;
      })()}
      ${this._groupRow(a)} ${this._favouritesGrid()}
    </div>`;
  }

  _groupRow(a) {
    const cfg = this._config;
    // Gate on GROUPING — a `group:` list on a player that can't join does nothing.
    if (
      !Array.isArray(cfg.group) ||
      !cfg.group.length ||
      !this._supports(MF.GROUPING)
    )
      return "";
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
              this._do("play_media", {
                media_content_id: f.media_content_id,
                media_content_type: f.media_content_type || "music",
              })}
          >
            <div
              class="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[10px]
                   bg-card2 bg-cover bg-center"
              style=${f.thumbnail ? `background-image:${cssUrl(f.thumbnail)}` : ""}
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

  /** Masonry height hint — art + transport + volume ≈ 3 rows. */
  getCardSize() {
    return 3;
  }
  /** Sections-view layout: full-width, three rows tall. */
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 3 };
  }
  /** Grid-view sizing: full-width, auto height. */
  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }
}
