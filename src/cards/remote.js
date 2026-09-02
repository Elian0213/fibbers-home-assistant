/* ================================================================== *
 * fibbers-remote — a real TV remote: a round d-pad, transport, source/app
 * launcher and volume, over `remote.send_command`. Point `media_player:` at the
 * player and the card also shows now-playing, a source grid (`select_source`)
 * and a volume slider. `device:` (philips | appletv | generic) sets the header
 * icon so two remotes on one page are distinguishable.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t } from "../i18n.js";
import { twSheet } from "../tw.js";
import { sliderTrack, overflowChips, SliderHold } from "../ui.js";
import { pickEntity, pctFromX } from "../util.js";
import "../icon.js";

const DEFAULTS = {
  power: "POWER",
  up: "DPAD_UP",
  down: "DPAD_DOWN",
  left: "DPAD_LEFT",
  right: "DPAD_RIGHT",
  ok: "DPAD_CENTER",
  back: "BACK",
  home: "HOME",
  menu: "MENU",
  volume_up: "VOLUME_UP",
  volume_down: "VOLUME_DOWN",
  volume_mute: "MUTE",
  channel_up: "CHANNEL_UP",
  channel_down: "CHANNEL_DOWN",
  previous: "MEDIA_PREVIOUS",
  next: "MEDIA_NEXT",
  play: "MEDIA_PLAY_PAUSE",
};

const DEVICE_ICON = {
  philips: "solar:tv-bold-duotone",
  appletv: "solar:tv-bold-duotone",
  generic: "solar:gamepad-bold-duotone",
};

export class FibbersRemote extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _dragging: { state: true },
    _dragVol: { state: true },
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
      type: "custom:fibbers-remote",
      entity: pickEntity(
        "remote",
        entities,
        entitiesFallback,
        "remote.example",
      ),
    };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("fibbers-remote: `entity` (a remote.*) is required");
    }
    if (
      config.sources != null &&
      config.sources !== "auto" &&
      !Array.isArray(config.sources)
    ) {
      throw new Error('fibbers-remote: `sources` must be "auto" or a list');
    }
    if (config.device != null && !DEVICE_ICON[config.device]) {
      throw new Error(
        'fibbers-remote: `device` must be "philips", "appletv" or "generic"',
      );
    }
    this._config = config;
    this._dragging = false;
    this._dragVol = 0;
    this._srcOpen = false;
    this._volHold = new SliderHold(this, { tolerance: 2 });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._release(); // don't let a held button keep firing after unmount
  }

  // The optional media_player backing now-playing / sources / volume.
  _mp() {
    const id = this._config.media_player;
    return id && this.hass ? this.hass.states[id] : null;
  }

  _send(key) {
    const cmd = (this._config.commands || {})[key] || DEFAULTS[key];
    if (cmd && this.hass)
      this.hass.callService("remote", "send_command", {
        entity_id: this._config.entity,
        command: cmd,
      });
  }

  _mpService(service, data) {
    const mp = this._mp();
    if (mp && this.hass)
      this.hass.callService("media_player", service, {
        entity_id: mp.entity_id,
        ...data,
      });
  }

  // Long-press repeat (volume / channel): fire once, then every 140ms until release.
  _hold(key) {
    this._send(key);
    clearInterval(this._repeat);
    this._repeat = setInterval(() => this._send(key), 140);
  }
  _release() {
    clearInterval(this._repeat);
    this._repeat = null;
  }

  // The full source list: explicit `sources` (strings or {name, source, icon}),
  // or `auto` from the player's source_list.
  _allSources() {
    const cfg = this._config;
    if (!cfg.sources) return [];
    const mp = this._mp();
    return cfg.sources === "auto"
      ? ((mp && mp.attributes.source_list) || []).map((s) => ({
          name: s,
          source: s,
        }))
      : cfg.sources.map((s) =>
          typeof s === "string" ? { name: s, source: s } : s,
        );
  }

  // The collapsed row: `favourites` in their listed order (each resolved against
  // the full list). null → no favourites, so no drawer and everything shows.
  _favSources(all) {
    const favs = this._config.favourites;
    if (!Array.isArray(favs) || !favs.length) return null;
    const byValue = new Map(all.map((s) => [s.source || s.name, s]));
    return favs.map((f) => byValue.get(f) || { name: f, source: f });
  }

  _volDown(e) {
    this._dragging = true;
    e.currentTarget.setPointerCapture &&
      e.currentTarget.setPointerCapture(e.pointerId);
    this._dragVol = Math.round(pctFromX(e.clientX, e.currentTarget));
  }
  _volMove(e) {
    if (this._dragging)
      this._dragVol = Math.round(pctFromX(e.clientX, e.currentTarget));
  }
  _volUp(e) {
    if (!this._dragging) return;
    const v = Math.round(pctFromX(e.clientX, e.currentTarget));
    this._dragging = false;
    this._setVol(v);
  }
  _setVol(pct) {
    this._volHold.hold(pct);
    this._mpService("volume_set", { volume_level: pct / 100 });
  }

  // --- render helpers ------------------------------------------------

  _round(label, icon, onClick, size = "h-11 w-11") {
    return html`<button
      type="button"
      aria-label=${label}
      class="flex ${size} flex-none items-center justify-center rounded-full bg-card2
             text-ink transition-transform active:scale-90"
      @click=${onClick}
    >
      <fib-icon
        class="h-[19px] w-[19px] [--mdc-icon-size:19px]"
        icon=${icon}
      ></fib-icon>
    </button>`;
  }

  // Press-and-hold button (volume / channel) with repeat.
  _holdBtn(label, icon, key) {
    return html`<button
      type="button"
      aria-label=${label}
      class="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-card2
             text-ink transition-transform active:scale-90"
      @pointerdown=${() => this._hold(key)}
      @pointerup=${() => this._release()}
      @pointercancel=${() => this._release()}
      @pointerleave=${() => this._release()}
    >
      <fib-icon
        class="h-[19px] w-[19px] [--mdc-icon-size:19px]"
        icon=${icon}
      ></fib-icon>
    </button>`;
  }

  _dpad() {
    const arrow = (key, icon, label, pos) =>
      html`<button
        type="button"
        aria-label=${label}
        class="absolute ${pos} flex h-12 w-12 items-center justify-center rounded-full
             text-ink transition-transform hover:bg-card active:scale-90"
        @click=${() => this._send(key)}
      >
        <fib-icon
          class="h-[22px] w-[22px] [--mdc-icon-size:22px]"
          icon=${icon}
        ></fib-icon>
      </button>`;
    return html`<div
      class="relative mx-auto h-[168px] w-[168px] rounded-full bg-card2"
      role="group"
      aria-label="D-pad"
    >
      ${arrow(
        "up",
        "solar:alt-arrow-up-bold-duotone",
        "Up",
        "left-1/2 top-1 -translate-x-1/2",
      )}
      ${arrow(
        "down",
        "solar:alt-arrow-down-bold-duotone",
        "Down",
        "bottom-1 left-1/2 -translate-x-1/2",
      )}
      ${arrow(
        "left",
        "solar:alt-arrow-left-bold-duotone",
        "Left",
        "left-1 top-1/2 -translate-y-1/2",
      )}
      ${arrow(
        "right",
        "solar:alt-arrow-right-bold-duotone",
        "Right",
        "right-1 top-1/2 -translate-y-1/2",
      )}
      <button
        type="button"
        aria-label="OK"
        class="absolute left-1/2 top-1/2 flex h-[60px] w-[60px] -translate-x-1/2 -translate-y-1/2
               items-center justify-center rounded-full bg-accentbg text-accent
               shadow-[0_1px_3px_rgba(0,0,0,.4)] transition-transform active:scale-90"
        @click=${() => this._send("ok")}
      >
        <span class="text-[13px] font-semibold">OK</span>
      </button>
    </div>`;
  }

  _transport() {
    const mp = this._mp();
    const playIcon =
      mp && mp.state === "playing"
        ? "solar:pause-bold-duotone"
        : "solar:play-bold-duotone";
    const tp = (label, icon, key, mpService) =>
      this._round(
        label,
        icon,
        mp ? () => this._mpService(mpService) : () => this._send(key),
      );
    return html`<div class="flex items-center justify-center gap-2.5">
      ${tp(
        "Previous",
        "solar:skip-previous-bold-duotone",
        "previous",
        "media_previous_track",
      )}
      ${tp("Play / pause", playIcon, "play", "media_play_pause")}
      ${tp("Next", "solar:skip-next-bold-duotone", "next", "media_next_track")}
      <span class="mx-0.5 h-8 w-px flex-none bg-line"></span>
      ${this._round("Back", "solar:arrow-left-bold-duotone", () =>
        this._send("back"),
      )}
      ${this._round("Home", "solar:home-2-bold-duotone", () =>
        this._send("home"),
      )}
      ${this._round("Menu", "solar:menu-dots-bold-duotone", () =>
        this._send("menu"),
      )}
    </div>`;
  }

  _volume() {
    const mp = this._mp();
    const hasVol = mp && mp.attributes.volume_level != null;
    const muted = mp && mp.attributes.is_volume_muted;
    const channel = html`${this._holdBtn(
        "Channel down",
        "solar:alt-arrow-down-bold-duotone",
        "channel_down",
      )}
      <span
        class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
        >CH</span
      >
      ${this._holdBtn(
        "Channel up",
        "solar:alt-arrow-up-bold-duotone",
        "channel_up",
      )}`;

    if (hasVol) {
      const vol = this._volHold.value(
        Math.round(mp.attributes.volume_level * 100),
        { dragging: this._dragging, dragValue: this._dragVol },
      );
      return html`<div class="flex flex-col gap-3">
        <div class="flex items-center gap-2.5">
          <button
            type="button"
            aria-label="Mute"
            aria-pressed=${muted ? "true" : "false"}
            class="flex h-8 w-8 flex-none items-center justify-center rounded-full
                   ${muted ? "bg-accentbg text-accent" : "bg-card2 text-muted"}"
            @click=${() =>
              this._mpService("volume_mute", { is_volume_muted: !muted })}
          >
            <fib-icon
              class="h-4 w-4 [--mdc-icon-size:16px]"
              icon=${
                muted
                  ? "solar:volume-cross-bold-duotone"
                  : "solar:volume-small-bold-duotone"
              }
            ></fib-icon>
          </button>
          ${sliderTrack({
            pct: vol,
            cls: "flex-1",
            label: "Volume",
            value: vol,
            min: 0,
            max: 100,
            step: 5,
            valueText: `${vol}%`,
            onInput: (v) => this._setVol(v),
            onDown: this._volDown,
            onMove: this._volMove,
            onUp: this._volUp,
            onCancel: () => {
              this._dragging = false;
            },
          })}
          <fib-icon
            class="h-4 w-4 flex-none [--mdc-icon-size:16px] text-muted"
            icon="solar:volume-loud-bold-duotone"
          ></fib-icon>
        </div>
        <div class="flex items-center justify-center gap-2.5">${channel}</div>
      </div>`;
    }

    return html`<div class="flex items-center justify-center gap-2.5">
      ${this._holdBtn(
        "Volume down",
        "solar:volume-small-bold-duotone",
        "volume_down",
      )}
      ${this._round("Mute", "solar:volume-cross-bold-duotone", () =>
        this._send("volume_mute"),
      )}
      ${this._holdBtn(
        "Volume up",
        "solar:volume-loud-bold-duotone",
        "volume_up",
      )}
      <span class="mx-0.5 h-8 w-px flex-none bg-line"></span>
      ${channel}
    </div>`;
  }

  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const mp = this._mp();
    const on = mp
      ? !["off", "unavailable", "standby"].includes(mp.state)
      : null;
    const nowLine = mp
      ? mp.attributes.media_title ||
        mp.attributes.app_name ||
        mp.attributes.source ||
        (on ? "On" : "Off")
      : "";
    const all = this._allSources();
    const collapsed = this._favSources(all);
    const activeSource = mp && mp.attributes.source;

    return html`<div
      class="flex flex-col gap-3 rounded-[14px] border border-line bg-card p-[13px]"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]
                 ${on ? "bg-accentbg text-accent" : "bg-card2 text-muted"}"
        >
          <fib-icon
            class="h-[19px] w-[19px] [--mdc-icon-size:19px]"
            icon=${DEVICE_ICON[cfg.device] || DEVICE_ICON.generic}
          ></fib-icon>
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-[12px] font-semibold text-ink">
            ${cfg.name || t(hl, "remote.default_name")}
          </div>
          <div class="truncate text-[10.5px] text-muted">${nowLine}</div>
        </div>
        ${this._round(
          "Power",
          "solar:power-bold-duotone",
          () => this._send("power"),
          "h-9 w-9",
        )}
      </div>

      ${this._dpad()} ${this._transport()} ${this._volume()}
      ${
        all.length
          ? overflowChips({
              hl,
              all,
              collapsed,
              activeValue: activeSource,
              open: this._srcOpen,
              onToggle: () => {
                this._srcOpen = !this._srcOpen;
              },
              onSelect: (s) =>
                this._mpService("select_source", {
                  source: s.source || s.name,
                }),
            })
          : ""
      }
    </div>`;
  }

  getCardSize() {
    return 4;
  }
  getLayoutOptions() {
    return { grid_columns: 6, grid_rows: 4 };
  }
  getGridOptions() {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }
}
