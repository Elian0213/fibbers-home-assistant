/* ================================================================== *
 * fibbers-remote — a real TV remote over `remote.send_command`, with the correct
 * command names per platform. The command family is derived from the entity's
 * integration (apple_tv → pyatv lowercase, philips_js → Cursor…/Standby, Android
 * TV → DPAD_…); `device:` overrides the guess and `commands:` overrides per key.
 * Point `media_player:` at the player for now-playing, a select_source grid and a
 * volume slider. Buttons a platform doesn't support aren't rendered.
 *
 * One card can hold several `devices:` and switch between them with a segmented
 * tablist. A top-level `entity:`/`media_player:` (no `devices:`) is normalised to a
 * single-device list and renders no switcher — 0.7.x configs are unchanged.
 * ================================================================== */
import { LitElement, html, css, nothing } from "lit";

import { t } from "../i18n.js";
import { twSheet } from "../tw.js";
import { sliderTrack, overflowChips, SliderHold } from "../ui.js";
import { pickEntity, pctFromX, isUnavail, store } from "../util.js";
import "../icon.js";

// Per-platform command names. A key absent here (and from `commands:`) means the
// device can't do it, so that button doesn't render.
const COMMANDS = {
  appletv: {
    up: "up",
    down: "down",
    left: "left",
    right: "right",
    ok: "select",
    menu: "menu",
    home: "home",
    back: "menu",
    play: "play_pause",
    next: "next",
    previous: "previous",
    volume_up: "volume_up",
    volume_down: "volume_down",
  },
  philips: {
    up: "CursorUp",
    down: "CursorDown",
    left: "CursorLeft",
    right: "CursorRight",
    ok: "Confirm",
    back: "Back",
    home: "Home",
    play: "Play",
    volume_up: "VolumeUp",
    volume_down: "VolumeDown",
    volume_mute: "Mute",
    channel_up: "ChannelStepUp",
    channel_down: "ChannelStepDown",
    power: "Standby",
  },
  androidtv: {
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
  },
  generic: {},
};

const PLATFORM_DEVICE = {
  apple_tv: "appletv",
  philips_js: "philips",
  androidtv: "androidtv", // the media_player platform
  androidtv_remote: "androidtv", // the remote.* platform that uses these keycodes
};

const DEVICE_ICON = {
  appletv: "solar:tv-bold-duotone",
  philips: "solar:tv-bold-duotone",
  androidtv: "solar:tv-bold-duotone",
  generic: "solar:gamepad-bold-duotone",
};
// A device with a media_player but no remote entity is a speaker, not a TV.
const SPEAKER_ICON = "solar:smart-speaker-bold-duotone";

// A remote/player is "off" in any of these — so `unknown` isn't treated as on
// (used for the header/switcher dots and the Apple TV power direction).
const OFF_STATES = ["off", "standby", "unavailable", "unknown"];
const GONE_STATES = ["unavailable", "unknown", "off"];

// media_player supported_features bits used here.
const MF_VOLUME_MUTE = 8;
const MF_VOLUME_STEP = 1024;

const DPAD_MODES = ["swipe", "buttons", "both", "grid"];
// Every button/target is at least the shared --fib-hit (44px) square.
const BTN = "h-[var(--fib-hit)] w-[var(--fib-hit)]";

export class FibbersRemote extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _sel: { state: true },
    _dragging: { state: true },
    _dragVol: { state: true },
    _srcOpen: { state: true },
    _flash: { state: true },
  };
  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
      /* container queries respond to the CARD's own width, not the viewport — the
         whole point (min(72vw,…) used the viewport and overflowed a narrow cell). */
      .card {
        container-type: inline-size;
      }
      .body {
        display: grid;
        gap: 12px;
      }
      @container (min-width: 380px) {
        .body {
          grid-template-columns: minmax(0, 260px) minmax(0, 1fr);
          align-items: start;
        }
        .body > .dpad {
          grid-row: span 2;
        }
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
    if (!config) throw new Error("fibbers-remote: config is required");
    // Normalise to a device list: `devices:` if given, else the legacy flat config
    // as a single device. A one-device card renders no switcher.
    const devices =
      Array.isArray(config.devices) && config.devices.length
        ? config.devices
        : [config];
    devices.forEach((d, i) => {
      if (!d || (!d.entity && !d.media_player)) {
        throw new Error(
          `fibbers-remote: device[${i}] needs \`entity\` (a remote.*) or \`media_player\``,
        );
      }
      if (d.device != null && !COMMANDS[d.device]) {
        throw new Error(
          'fibbers-remote: `device` must be "appletv", "philips", "androidtv" or "generic"',
        );
      }
      if (d.device === "generic" && !d.commands) {
        throw new Error(
          "fibbers-remote: `device: generic` makes no command assumptions — provide a `commands:` map",
        );
      }
      if (d.dpad != null && !DPAD_MODES.includes(d.dpad)) {
        throw new Error(
          'fibbers-remote: `dpad` must be "swipe", "buttons", "both" or "grid"',
        );
      }
      if (
        d.sources != null &&
        d.sources !== "auto" &&
        !Array.isArray(d.sources)
      ) {
        throw new Error('fibbers-remote: `sources` must be "auto" or a list');
      }
      if ((d.sources || d.favourites) && !d.media_player) {
        throw new Error(
          "fibbers-remote: `sources`/`favourites` need a `media_player:` — they call media_player.select_source",
        );
      }
    });

    this._config = config;
    this._devices = devices;
    // Per-entity platform resolution and warn-once sets — keyed so device B never
    // inherits device A's resolved command family.
    this._platform = this._platform || new Map();
    this._tried = this._tried || new Set();
    this._warned = this._warned || new Set();
    this._autoDone = false;
    this._resetTransient();

    // Restore the remembered device (keyed on the list, so adding a device doesn't
    // restore a stale index).
    this._sel = 0;
    if (config.remember !== false) {
      const saved = store.get(this._persistKey(), 0);
      if (Number.isInteger(saved) && saved >= 0 && saved < devices.length)
        this._sel = saved;
    }

    // Construct the hold once — SliderHold.addController has no removeController,
    // so a new one per setConfig would orphan controllers in the editor.
    if (!this._volHold) this._volHold = new SliderHold(this, { tolerance: 2 });
    else this._volHold.clear();
  }

  _resetTransient() {
    this._dragging = false;
    this._dragVol = 0;
    this._srcOpen = false;
    this._flash = null;
  }

  _persistKey() {
    const ids = this._devices.map((d) => d.entity || d.media_player || d.name);
    return `fibbers:remote:${ids.join("|")}`;
  }

  connectedCallback() {
    super.connectedCallback();
    this._onHidden = () => {
      if (document.hidden) this._release();
    };
    document.addEventListener("visibilitychange", this._onHidden);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this._release(); // a held button must not keep firing after unmount
    clearTimeout(this._flashTimer);
    document.removeEventListener("visibilitychange", this._onHidden);
  }

  updated(changed) {
    if (changed.has("hass") || changed.has("_sel")) this._resolvePlatform();
    // `auto_select: playing` applies once on mount — never mid-session, which would
    // yank the card out from under a thumb when a speaker starts playing.
    if (
      !this._autoDone &&
      this.hass &&
      this._config.auto_select === "playing"
    ) {
      this._autoDone = true;
      const i = this._devices.findIndex((d) => {
        const mp = d.media_player && this.hass.states[d.media_player];
        return mp && mp.state === "playing";
      });
      if (i >= 0 && i !== this._sel) this._sel = i;
    }
  }

  // Resolve the current device's integration once, so the default command family is
  // right without the user picking. Unknown platform → generic (needs `commands:`).
  async _resolvePlatform() {
    const d = this._dev();
    if (!d || !d.entity) return;
    const id = d.entity;
    if (this._tried.has(id) || !this.hass || !this.hass.callWS) return;
    this._tried.add(id);
    try {
      const reg = await this.hass.callWS({
        type: "config/entity_registry/get",
        entity_id: id,
      });
      if (reg && reg.platform) {
        this._platform.set(id, reg.platform);
        this.requestUpdate();
      }
    } catch (_) {
      /* left unresolved → generic */
    }
  }

  // --- current device -------------------------------------------------

  _dev() {
    return (this._devices && this._devices[this._sel]) || {};
  }
  _select(i) {
    if (i === this._sel || i < 0 || i >= this._devices.length) return;
    // Nothing from the old device may bleed onto the new one.
    this._release();
    this._volHold.clear();
    this._resetTransient();
    this._sel = i;
    if (this._config.remember !== false) store.set(this._persistKey(), i);
  }

  _kindOf(d) {
    return (
      d.device || PLATFORM_DEVICE[this._platform.get(d.entity)] || "generic"
    );
  }
  _device() {
    return this._kindOf(this._dev());
  }
  _iconOf(d) {
    if (d.icon) return d.icon;
    if (!d.entity) return SPEAKER_ICON;
    return DEVICE_ICON[this._kindOf(d)] || DEVICE_ICON.generic;
  }
  _onState(d) {
    const st =
      (d.entity && this.hass && this.hass.states[d.entity]) ||
      (d.media_player && this.hass && this.hass.states[d.media_player]);
    return st ? !OFF_STATES.includes(st.state) : false;
  }

  // The command string for a logical key: `commands:` override, else the device
  // map. undefined → the platform can't do it (button won't render).
  _cmd(key) {
    const override = (this._dev().commands || {})[key];
    if (override != null) return override;
    return (COMMANDS[this._device()] || {})[key];
  }

  _mp() {
    const id = this._dev().media_player;
    return id && this.hass ? this.hass.states[id] : null;
  }
  _st() {
    const id = this._dev().entity;
    return id && this.hass ? this.hass.states[id] : null;
  }
  _mpSupports(mp, bit) {
    return (((mp && mp.attributes.supported_features) || 0) & bit) === bit;
  }
  _unavail() {
    const d = this._dev();
    return d.entity ? isUnavail(this._st()) : isUnavail(this._mp());
  }

  // --- commands & services -------------------------------------------

  // A rejected send_command dies silently in a fire-and-forget call; catch it,
  // warn once per key with the command + platform, and flash the button — a dead
  // remote shouldn't look identical to a working one.
  async _send(key) {
    const cmd = this._cmd(key);
    const id = this._dev().entity;
    if (!cmd || !id || !this.hass || this._unavail()) return;
    try {
      await this.hass.callService("remote", "send_command", {
        entity_id: id,
        command: cmd,
      });
    } catch (e) {
      this._flashFail(key, e, cmd);
    }
  }

  _flashFail(key, e, cmd) {
    const id = this._dev().entity;
    const warnKey = `${id}:${key}`;
    if (!this._warned.has(warnKey)) {
      this._warned.add(warnKey);
      console.warn(
        `[fibbers-remote] command "${cmd || key}" was rejected by ${id} ` +
          `(platform: ${this._platform.get(id) || "unknown"}). ${e && e.message ? e.message : e}`,
      );
    }
    this._flash = key;
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      this._flash = null;
    }, 500);
  }

  // Apple TV power lives on the remote's own turn_on/turn_off/toggle services, not
  // in the command map; direction follows the remote entity's own state.
  _power() {
    if (this._device() !== "appletv") return this._send("power");
    const id = this._dev().entity;
    if (!id || !this.hass || this._unavail()) return;
    const st = this._st();
    const on = st ? !OFF_STATES.includes(st.state) : null;
    const svc = on === null ? "toggle" : on ? "turn_off" : "turn_on";
    this.hass
      .callService("remote", svc, { entity_id: id })
      .catch((e) => this._flashFail("power", e, `remote.${svc}`));
  }

  _mpService(service, data) {
    const mp = this._mp();
    if (mp && this.hass)
      this.hass.callService("media_player", service, {
        entity_id: mp.entity_id,
        ...data,
      });
  }

  // Long-press repeat, bounded: ~3/s (not 7/s), capped, and stopped on release /
  // cancel / lost capture / the tab hiding (handled in connectedCallback).
  _hold(fn) {
    if (this._unavail()) return;
    this._release();
    fn();
    let count = 0;
    this._repeat = setInterval(() => {
      if ((count += 1) > 40) return this._release(); // hard cap ~12s
      return fn();
    }, 300);
  }
  _release() {
    clearInterval(this._repeat);
    this._repeat = null;
  }

  _allSources() {
    const d = this._dev();
    if (!d.sources) return [];
    const mp = this._mp();
    return d.sources === "auto"
      ? ((mp && mp.attributes.source_list) || []).map((s) => ({
          name: s,
          source: s,
        }))
      : d.sources.map((s) =>
          typeof s === "string" ? { name: s, source: s } : s,
        );
  }
  _favSources(all) {
    const favs = this._dev().favourites;
    if (!Array.isArray(favs) || !favs.length) return null;
    const byValue = new Map(all.map((s) => [s.source || s.name, s]));
    return favs.map((f) => byValue.get(f) || { name: f, source: f });
  }

  _setVol(pct) {
    this._volHold.hold(pct);
    this._mpService("volume_set", { volume_level: pct / 100 });
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

  // --- render helpers ------------------------------------------------

  _flashCls(key) {
    return this._flash === key ? "opacity-40" : "";
  }

  // A round button; ≥44px. `key` (optional) drives the rejected-command flash.
  _round(label, icon, onClick, size = BTN, key) {
    return html`<button
      type="button"
      aria-label=${label}
      class="flex ${size} flex-none items-center justify-center rounded-full bg-card2
             text-ink transition-transform active:scale-90 ${this._flashCls(key)}"
      @click=${onClick}
    >
      <fib-icon
        class="h-[20px] w-[20px] [--mdc-icon-size:20px]"
        icon=${icon}
      ></fib-icon>
    </button>`;
  }

  // A press-and-hold button (auto-repeats). `fn` is the action; `key` (for a remote
  // command) drives the flash and lets the click fall back on keyboard activation.
  _holdBtn(label, icon, fn, key) {
    return html`<button
      type="button"
      aria-label=${label}
      class="flex ${BTN} flex-none items-center justify-center rounded-full bg-card2
             text-ink transition-transform active:scale-90 ${this._flashCls(key)}"
      @pointerdown=${() => this._hold(fn)}
      @pointerup=${() => this._release()}
      @pointercancel=${() => this._release()}
      @pointerleave=${() => this._release()}
      @lostpointercapture=${() => this._release()}
      @click=${(e) => {
        if (e.detail === 0) fn(); // keyboard activation (no repeat)
      }}
    >
      <fib-icon
        class="h-[20px] w-[20px] [--mdc-icon-size:20px]"
        icon=${icon}
      ></fib-icon>
    </button>`;
  }

  _muteBtn(muted, onClick) {
    return html`<button
      type="button"
      aria-label="Mute"
      aria-pressed=${muted ? "true" : "false"}
      class="fib-hit flex h-9 w-9 flex-none items-center justify-center rounded-full
             ${muted ? "bg-accentbg text-accent" : "bg-card2 text-muted"}"
      @click=${onClick}
    >
      <fib-icon
        class="h-4 w-4 [--mdc-icon-size:16px]"
        icon=${
          muted
            ? "solar:volume-cross-bold-duotone"
            : "solar:volume-small-bold-duotone"
        }
      ></fib-icon>
    </button>`;
  }

  // Keyboard for the swipe d-pad (which has no arrow buttons to Tab to).
  _dpadKey(e) {
    const map = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      Enter: "ok",
      " ": "ok",
    };
    const key = map[e.key];
    if (!key) return;
    e.preventDefault();
    this._send(key);
  }

  _swipeStart(e) {
    this._sw = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture &&
      e.currentTarget.setPointerCapture(e.pointerId);
  }
  _swipeEnd(e) {
    const s = this._sw;
    this._sw = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.hypot(dx, dy) < 24) return this._send("ok"); // tap
    return this._send(
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
          ? "down"
          : "up",
    );
  }

  _switcher(hl) {
    if (this._devices.length <= 1) return "";
    // ≤4 fit on one wrapping row; more scroll horizontally so segments stay ≥44px
    // rather than shrinking below the touch minimum.
    const many = this._devices.length > 4;
    return html`<div
      role="tablist"
      aria-label=${t(hl, "remote.devices")}
      class="flex ${
        many ? "flex-nowrap overflow-x-auto" : "flex-wrap"
      } gap-x-1.5 gap-y-[10px]"
      @keydown=${this._switcherKey}
    >
      ${this._devices.map((d, i) => {
        const sel = i === this._sel;
        const on = this._onState(d);
        return html`<button
          type="button"
          role="tab"
          id="fibtab-${i}"
          aria-selected=${sel ? "true" : "false"}
          aria-controls="fibpanel"
          tabindex=${sel ? 0 : -1}
          class="fib-hit inline-flex min-h-[var(--fib-hit)] flex-none items-center gap-1.5
                 rounded-full border px-3 text-[11px] font-medium ${
                   sel
                     ? "border-accentline bg-accentbg text-accent"
                     : "border-line bg-card2 text-ink2"
                 }"
          @click=${() => this._select(i)}
        >
          <fib-icon
            class="h-[15px] w-[15px] [--mdc-icon-size:15px]"
            icon=${this._iconOf(d)}
          ></fib-icon>
          <span class="max-w-[10ch] truncate">${d.name || `#${i + 1}`}</span>
          ${
            on
              ? html`<span
                  class="h-1.5 w-1.5 flex-none rounded-full bg-accent"
                ></span>`
              : ""
          }
        </button>`;
      })}
    </div>`;
  }

  // Roving focus for the switcher tablist; Left/Right/Home/End, activate on move.
  _switcherKey(e) {
    const delta = { ArrowLeft: -1, ArrowRight: 1 };
    const tabs = [...e.currentTarget.querySelectorAll('[role="tab"]')];
    const cur = e.composedPath().find((el) => tabs.includes(el));
    const idx = tabs.indexOf(cur);
    if (idx < 0) return;
    let next;
    if (e.key in delta) next = (idx + delta[e.key] + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    tabs[next].focus();
    this._select(next);
  }

  _dpad() {
    const has = (k) => !!this._cmd(k);
    // No directional commands (e.g. a speaker, or generic with none) → no d-pad.
    if (!["up", "down", "left", "right", "ok"].some(has)) return "";
    const mode =
      this._dev().dpad || (this._device() === "appletv" ? "both" : "buttons");
    if (mode === "grid") return this._dpadGrid(has);
    return this._dpadCircle(has, mode);
  }

  _arrowBtn(key, icon, label, extra = "", onDown) {
    return html`<button
      type="button"
      aria-label=${label}
      class="flex items-center justify-center rounded-full text-ink transition-transform
             hover:bg-card active:scale-90 ${extra} ${this._flashCls(key)}"
      @pointerdown=${onDown}
      @click=${() => this._send(key)}
    >
      <fib-icon
        class="h-[24px] w-[24px] [--mdc-icon-size:24px]"
        icon=${icon}
      ></fib-icon>
    </button>`;
  }

  _okBtn(size, onDown) {
    return html`<button
      type="button"
      aria-label="OK"
      class="flex ${size} items-center justify-center rounded-full bg-accentbg text-accent
             shadow-[0_1px_3px_rgba(0,0,0,.4)] transition-transform active:scale-90
             ${this._flashCls("ok")}"
      @pointerdown=${onDown}
      @click=${() => this._send("ok")}
    >
      <span class="text-[15px] font-semibold">OK</span>
    </button>`;
  }

  _dpadCircle(has, mode) {
    const swipe = mode !== "buttons";
    const buttons = mode !== "swipe";
    // Buttons win over the swipe surface: stop the container from also seeing it.
    const stop = swipe ? (e) => e.stopPropagation() : undefined;
    const arrow = (key, icon, label, pos) =>
      has(key)
        ? this._arrowBtn(key, icon, label, `absolute ${pos} h-14 w-14`, stop)
        : "";
    const label = !swipe
      ? "D-pad"
      : buttons
        ? "D-pad — swipe, tap an arrow, or use the arrow keys"
        : "D-pad — swipe or use the arrow keys";
    return html`<div
      class="dpad relative mx-auto aspect-square w-full max-w-[260px] touch-none rounded-full
             bg-card2 ${swipe ? "cursor-pointer" : ""}"
      role="group"
      aria-label=${label}
      tabindex=${swipe ? 0 : nothing}
      @keydown=${swipe ? this._dpadKey : undefined}
      @pointerdown=${swipe ? this._swipeStart : undefined}
      @pointerup=${swipe ? this._swipeEnd : undefined}
      @pointercancel=${swipe ? () => (this._sw = null) : undefined}
    >
      ${
        buttons
          ? html`${arrow(
              "up",
              "solar:alt-arrow-up-bold-duotone",
              "Up",
              "left-1/2 top-2 -translate-x-1/2",
            )}
            ${arrow(
              "down",
              "solar:alt-arrow-down-bold-duotone",
              "Down",
              "bottom-2 left-1/2 -translate-x-1/2",
            )}
            ${arrow(
              "left",
              "solar:alt-arrow-left-bold-duotone",
              "Left",
              "left-2 top-1/2 -translate-y-1/2",
            )}
            ${arrow(
              "right",
              "solar:alt-arrow-right-bold-duotone",
              "Right",
              "right-2 top-1/2 -translate-y-1/2",
            )}`
          : ""
      }
      ${
        has("ok")
          ? this._okBtn(
              "absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2",
              stop,
            )
          : ""
      }
    </div>`;
  }

  // A 3×3 grid d-pad: up/left/OK/right/down, empty corners. Denser and unmistakable
  // on a phone; every cell is a full ≥44px target.
  _dpadGrid(has) {
    const cell = (key, icon, label) =>
      has(key)
        ? this._arrowBtn(
            key,
            icon,
            label,
            "aspect-square w-full min-h-[var(--fib-hit)] bg-card2",
          )
        : html`<div></div>`;
    return html`<div
      class="dpad mx-auto grid w-full max-w-[240px] grid-cols-3 gap-1.5"
      role="group"
      aria-label="D-pad"
    >
      <div></div>
      ${cell("up", "solar:alt-arrow-up-bold-duotone", "Up")}
      <div></div>
      ${cell("left", "solar:alt-arrow-left-bold-duotone", "Left")}
      ${
        has("ok")
          ? this._okBtn("aspect-square w-full min-h-[var(--fib-hit)]")
          : html`<div></div>`
      }
      ${cell("right", "solar:alt-arrow-right-bold-duotone", "Right")}
      <div></div>
      ${cell("down", "solar:alt-arrow-down-bold-duotone", "Down")}
      <div></div>
    </div>`;
  }

  _transport() {
    const mp = this._mp();
    const playIcon =
      mp && mp.state === "playing"
        ? "solar:pause-bold-duotone"
        : "solar:play-bold-duotone";
    const tp = (label, icon, key, mpService) => {
      if (!this._cmd(key) && !mp) return "";
      return this._round(
        label,
        icon,
        mp ? () => this._mpService(mpService) : () => this._send(key),
        BTN,
        key,
      );
    };
    const navBtn = (label, icon, key) =>
      this._cmd(key)
        ? this._round(label, icon, () => this._send(key), BTN, key)
        : "";
    const transport = [
      tp(
        "Previous",
        "solar:skip-previous-bold-duotone",
        "previous",
        "media_previous_track",
      ),
      tp("Play / pause", playIcon, "play", "media_play_pause"),
      tp("Next", "solar:skip-next-bold-duotone", "next", "media_next_track"),
    ].filter((x) => x !== "");
    // Apple TV aliases Back → menu; render Menu only when it's a distinct command.
    const showMenu =
      this._cmd("menu") && this._cmd("menu") !== this._cmd("back");
    const navs = [
      navBtn("Back", "solar:arrow-left-bold-duotone", "back"),
      navBtn("Home", "solar:home-2-bold-duotone", "home"),
      showMenu ? navBtn("Menu", "solar:menu-dots-bold-duotone", "menu") : "",
    ].filter((x) => x !== "");
    if (!transport.length && !navs.length) return "";
    // Two non-wrapping groups that stack as units — no separator to dangle at the
    // end of a wrapped row (the old flex-wrap + <span> divider hazard).
    return html`<div
      class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
    >
      ${
        transport.length
          ? html`<div class="flex items-center gap-2.5">${transport}</div>`
          : ""
      }
      ${
        navs.length
          ? html`<div class="flex items-center gap-2.5">${navs}</div>`
          : ""
      }
    </div>`;
  }

  _channelRow() {
    if (!this._cmd("channel_up")) return "";
    return html`<div class="flex items-center justify-center gap-2.5">
      ${this._holdBtn(
        "Channel down",
        "solar:alt-arrow-down-bold-duotone",
        () => this._send("channel_down"),
        "channel_down",
      )}
      <span
        class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
        >CH</span
      >
      ${this._holdBtn(
        "Channel up",
        "solar:alt-arrow-up-bold-duotone",
        () => this._send("channel_up"),
        "channel_up",
      )}
    </div>`;
  }

  // One row shape across all three cases so the card doesn't jump on switch:
  // slider (volume_level reported) · − / + (VOLUME_STEP or a volume command) · none.
  _volume() {
    const mp = this._mp();
    const hasSlider = mp && mp.attributes.volume_level != null;
    const remoteVol = !!this._cmd("volume_up");
    const mpStep = this._mpSupports(mp, MF_VOLUME_STEP);
    const hasStep = !hasSlider && (remoteVol || mpStep);
    const hasChannel = !!this._cmd("channel_up");
    if (!hasSlider && !hasStep && !hasChannel) return "";

    const rows = [];
    if (hasSlider) rows.push(this._volSlider(mp));
    else if (hasStep) rows.push(this._volSteps(mp, remoteVol));
    if (hasChannel) rows.push(this._channelRow());
    return html`<div class="flex flex-col gap-3">${rows}</div>`;
  }

  _volSlider(mp) {
    // If the player drops out mid-hold, release the optimistic value rather than
    // freezing the knob on it until the timeout.
    const gone = !mp || GONE_STATES.includes(mp.state);
    const vol = this._volHold.value(
      Math.round(mp.attributes.volume_level * 100),
      { dragging: this._dragging, dragValue: this._dragVol, gone },
    );
    const muted = mp.attributes.is_volume_muted;
    return html`<div class="flex items-center gap-2.5">
      ${
        this._mpSupports(mp, MF_VOLUME_MUTE)
          ? this._muteBtn(muted, () =>
              this._mpService("volume_mute", { is_volume_muted: !muted }),
            )
          : ""
      }
      ${sliderTrack({
        pct: vol,
        disabled: gone,
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
          this._volHold.clear();
        },
      })}
      <span
        class="w-10 flex-none text-right text-[11px] tabular-nums text-muted"
        >${vol}%</span
      >
    </div>`;
  }

  // No reported level → − / + with a non-draggable placeholder bar, so the row keeps
  // the slider's shape/height and the card doesn't jump when switching devices.
  _volSteps(mp, remoteVol) {
    const down = remoteVol
      ? this._holdBtn(
          "Volume down",
          "solar:volume-small-bold-duotone",
          () => this._send("volume_down"),
          "volume_down",
        )
      : this._holdBtn("Volume down", "solar:volume-small-bold-duotone", () =>
          this._mpService("volume_down"),
        );
    const up = remoteVol
      ? this._holdBtn(
          "Volume up",
          "solar:volume-loud-bold-duotone",
          () => this._send("volume_up"),
          "volume_up",
        )
      : this._holdBtn("Volume up", "solar:volume-loud-bold-duotone", () =>
          this._mpService("volume_up"),
        );
    const muted = mp && mp.attributes.is_volume_muted;
    const canMute = remoteVol
      ? !!this._cmd("volume_mute")
      : this._mpSupports(mp, MF_VOLUME_MUTE);
    const muteClick = remoteVol
      ? () => this._send("volume_mute")
      : () => this._mpService("volume_mute", { is_volume_muted: !muted });
    return html`<div class="flex items-center gap-2.5">
      ${canMute ? this._muteBtn(muted, muteClick) : ""} ${down}
      <div class="h-1.5 flex-1 rounded-[3px] bg-[#2C3639]"></div>
      ${up}
      <span class="w-10 flex-none"></span>
    </div>`;
  }

  _header(hl) {
    const d = this._dev();
    const mp = this._mp();
    const on = this._onState(d);
    const nowLine = mp
      ? mp.attributes.media_title ||
        mp.attributes.app_name ||
        mp.attributes.source ||
        t(hl, on ? "remote.on" : "remote.off")
      : d.entity
        ? t(hl, on ? "remote.on" : "remote.off")
        : "";
    return html`<div class="flex items-center gap-2.5">
      <div
        class="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]
               ${on ? "bg-accentbg text-accent" : "bg-card2 text-muted"}"
      >
        <fib-icon
          class="h-[19px] w-[19px] [--mdc-icon-size:19px]"
          icon=${this._iconOf(d)}
        ></fib-icon>
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-[12px] font-semibold text-ink">
          ${d.name || t(hl, "remote.default_name")}
        </div>
        <div class="truncate text-[10.5px] text-muted">${nowLine}</div>
      </div>
      ${
        d.entity
          ? this._round(
              "Power",
              "solar:power-bold-duotone",
              () => this._power(),
              BTN,
              "power",
            )
          : ""
      }
    </div>`;
  }

  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const multi = this._devices.length > 1;
    const all = this._allSources();
    const collapsed = this._favSources(all);
    const activeSource = this._mp() && this._mp().attributes.source;

    return html`<div
      class="card flex flex-col gap-3 rounded-[14px] border border-line bg-card p-[13px]
             ${this._unavail() ? "opacity-50" : ""}"
    >
      ${this._switcher(hl)} ${this._header(hl)}
      <div
        class="body"
        role=${multi ? "tabpanel" : nothing}
        id=${multi ? "fibpanel" : nothing}
        aria-labelledby=${multi ? `fibtab-${this._sel}` : nothing}
      >
        ${this._dpad()}
        <div class="flex min-w-0 flex-col gap-3">
          ${this._transport()} ${this._volume()}
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
        </div>
      </div>
    </div>`;
  }

  _needsDpad() {
    // A device with a remote entity gets a d-pad; speaker-only devices don't.
    return !!(this._devices && this._devices.some((d) => d.entity));
  }
  getCardSize() {
    return 4;
  }
  getLayoutOptions() {
    return {
      grid_columns: this._needsDpad() ? "full" : 6,
      grid_rows: "auto",
    };
  }
  getGridOptions() {
    return this._needsDpad()
      ? { columns: 12, rows: "auto", min_columns: 6 }
      : { columns: 6, rows: "auto", min_columns: 4 };
  }
}
