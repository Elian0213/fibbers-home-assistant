/* ================================================================== *
 * fibbers-remote — a real TV/speaker remote over `remote.send_command`, with the
 * correct command names per platform (derived from the entity's integration:
 * apple_tv → pyatv lowercase, philips_js → Cursor…/Standby, Android TV → DPAD_…);
 * `device:` overrides the guess, `commands:` overrides per key. Point `media_player:`
 * at the player for now-playing, source chips and a volume slider.
 *
 * Flat, Fibbers-native design: card2 surfaces, 1px lines, 14px radii, accent green
 * only where something is live. The d-pad is one SVG donut with four true annular
 * sectors (no clip-path corner-clipping); everything else sits below it in use
 * order. One card holds several `devices:` behind a segmented tablist; a legacy
 * top-level `entity:`/`media_player:` normalises to a single-device, switcher-less
 * card — 0.7.x configs render unchanged apart from the restyle.
 * ================================================================== */
import { LitElement, html, svg, css, nothing } from "lit";

import { t } from "../../shared/i18n.js";
import { twSheet } from "../../shared/tw.js";
import {
  sliderTrack,
  overflowChips,
  activateOnKey,
  SliderHold,
} from "../../shared/ui.js";
import { pickEntity, pctFromX, isUnavail, store } from "../../shared/util.js";
import "../../shared/icon.js";

// Per-platform command names. A key absent here (and from `commands:`) means the
// device can't do it, so that control doesn't render.
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

// media_player supported_features bits (HA core) — route a control down the path
// the player actually advertises, not just "a media_player exists".
const MF_PAUSE = 1;
const MF_VOLUME_MUTE = 8;
const MF_PREV = 16;
const MF_NEXT = 32;
const MF_VOLUME_STEP = 1024;
const MF_SELECT_SOURCE = 2048;
const MF_PLAY = 16384;

const DPAD_MODES = ["swipe", "buttons", "both", "grid"];

// SVG donut geometry (viewBox -104..104): outer radius 100, hub hole 40, four 76°
// sectors on ±90/0/180° with a 7° gap either side; `ix/iy` is the chevron anchor.
const SEG = {
  up: {
    d: "M -61.57 -78.80 A 100 100 0 0 1 61.57 -78.80 L 24.63 -31.52 A 40 40 0 0 0 -24.63 -31.52 Z",
    ix: 0,
    iy: -72,
  },
  right: {
    d: "M 78.80 -61.57 A 100 100 0 0 1 78.80 61.57 L 31.52 24.63 A 40 40 0 0 0 31.52 -24.63 Z",
    ix: 72,
    iy: 0,
  },
  down: {
    d: "M 61.57 78.80 A 100 100 0 0 1 -61.57 78.80 L -24.63 31.52 A 40 40 0 0 0 24.63 31.52 Z",
    ix: 0,
    iy: 72,
  },
  left: {
    d: "M -78.80 61.57 A 100 100 0 0 1 -78.80 -61.57 L -31.52 -24.63 A 40 40 0 0 0 -31.52 24.63 Z",
    ix: -72,
    iy: 0,
  },
};
// Outward-pointing chevron glyphs, drawn in wheel units at each sector's anchor.
const CHEV = {
  up: "M -7 3.5 L 0 -3.5 L 7 3.5",
  down: "M -7 -3.5 L 0 3.5 L 7 -3.5",
  left: "M 3.5 -7 L -3.5 0 L 3.5 7",
  right: "M -3.5 -7 L 3.5 0 L -3.5 7",
};
const ARROW = {
  up: "solar:alt-arrow-up-bold-duotone",
  down: "solar:alt-arrow-down-bold-duotone",
  left: "solar:alt-arrow-left-bold-duotone",
  right: "solar:alt-arrow-right-bold-duotone",
};

/**
 * fibbers-remote — a TV/speaker remote over `remote.send_command` with per-platform
 * command names derived from the entity's integration; holds several `devices:` and
 * switches between them with a segmented tablist.
 */
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
      /* Container queries respond to the CARD's own width, not the viewport, and the
         body is capped — a remote is a handheld object, not a 1000px slab. */
      .card {
        container-type: inline-size;
      }
      .layout {
        display: grid;
        gap: 13px;
      }
      .body {
        max-width: 320px;
        width: 100%;
        margin-inline: auto;
        display: grid;
        gap: 11px;
        min-width: 0;
      }
      /* Two columns only when there's a panel (sources) to fill the second track;
         a speaker with no sources stays one centred column, no dead space. */
      @container (min-width: 600px) {
        .layout.two {
          grid-template-columns: minmax(0, 320px) minmax(0, 1fr);
          align-items: start;
        }
      }

      /* device switcher rail */
      .rail {
        display: flex;
        gap: 5px;
        padding: 4px;
        border-radius: 14px;
        background: var(--color-card2);
        border: 1px solid var(--color-line);
      }
      .rail button {
        flex: 1;
        min-width: 0;
        min-height: 36px;
        border: 1px solid transparent;
        border-radius: 10px;
        background: transparent;
        color: var(--color-muted);
        font: inherit;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 0 8px;
      }
      .rail button .dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--color-accent);
        flex: none;
        opacity: 0;
      }
      .rail button.live .dot {
        opacity: 1;
      }
      .rail button[aria-selected="true"] {
        background: var(--color-accentbg);
        border-color: var(--color-accentline);
        color: var(--color-accenttx);
      }
      .rail .nm {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* header */
      .head {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .badge {
        width: 36px;
        height: 36px;
        flex: none;
        border-radius: 11px;
        display: grid;
        place-items: center;
        background: var(--color-accentbg);
        color: var(--color-accent);
        border: 1px solid var(--color-accentline);
      }
      .badge.off {
        background: var(--color-card2);
        color: var(--color-muted);
        border-color: var(--color-line);
      }
      .who {
        min-width: 0;
        flex: 1;
      }
      .who b {
        display: block;
        font-size: 12.5px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .who span {
        display: block;
        font-size: 10.5px;
        color: var(--color-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .power {
        width: var(--fib-hit);
        height: var(--fib-hit);
        flex: none;
        border-radius: 12px;
        cursor: pointer;
        border: 1px solid var(--color-line);
        background: var(--color-card2);
        color: var(--color-muted);
        display: grid;
        place-items: center;
      }
      .power.on {
        border-color: #3f3335;
        background: #252021;
        color: #c98679;
      }

      /* the wheel: one SVG donut, four true sectors + a hub */
      .wheel {
        width: 100%;
        max-width: 238px;
        margin-inline: auto;
        display: block;
      }
      .wheel .seg {
        fill: var(--color-card2);
        stroke: var(--color-line);
        stroke-width: 1.5;
        cursor: pointer;
        transition: fill 0.1s;
      }
      .wheel .seg:hover {
        fill: #2e393b;
      }
      .wheel .seg:active,
      .wheel .seg.flash {
        fill: var(--color-accentbg);
        stroke: var(--color-accentline);
      }
      .wheel .seg:focus-visible,
      .wheel .hub:focus-visible {
        outline: none;
        stroke: var(--color-accent);
        stroke-width: 2.5;
      }
      .wheel .glyph {
        fill: none;
        stroke: var(--color-ink2);
        stroke-width: 5.5;
        stroke-linecap: round;
        stroke-linejoin: round;
        pointer-events: none;
      }
      .wheel .hub {
        fill: var(--color-accentbg);
        stroke: var(--color-accentline);
        stroke-width: 1.5;
        cursor: pointer;
      }
      .wheel .hub:active {
        fill: #1e3627;
      }
      .wheel .hubtx {
        fill: var(--color-accenttx);
        font:
          600 15px/1 ui-sans-serif,
          system-ui,
          sans-serif;
        letter-spacing: 0.06em;
        text-anchor: middle;
        dominant-baseline: central;
        pointer-events: none;
      }

      /* 3×3 grid alternative (dpad: grid) */
      .pad {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 7px;
        width: 100%;
        max-width: 238px;
        margin-inline: auto;
      }
      .pad button {
        aspect-ratio: 1;
        min-height: var(--fib-hit);
        border: 1px solid var(--color-line);
        border-radius: 13px;
        background: var(--color-card2);
        color: var(--color-ink2);
        cursor: pointer;
        display: grid;
        place-items: center;
      }
      .pad button:active {
        background: var(--color-accentbg);
        border-color: var(--color-accentline);
        color: var(--color-accent);
      }
      .pad .blank {
        visibility: hidden;
      }
      .pad .ok {
        background: var(--color-accentbg);
        border-color: var(--color-accentline);
        color: var(--color-accenttx);
        font: 600 12.5px/1 inherit;
      }

      /* rows below the wheel, in use order */
      .row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      /* transport: one segmented strip, equal cells, hairline dividers */
      .strip {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: 1fr;
        border: 1px solid var(--color-line);
        border-radius: 14px;
        overflow: hidden;
        background: var(--color-card2);
      }
      .strip button {
        border: 0;
        border-left: 1px solid var(--color-line);
        background: transparent;
        color: var(--color-ink2);
        cursor: pointer;
        min-height: var(--fib-hit);
        display: grid;
        place-items: center;
      }
      .strip button:first-child {
        border-left: 0;
      }
      .strip button:active {
        background: var(--color-accentbg);
        color: var(--color-accent);
      }
      .strip button.pp {
        color: var(--color-accent);
      }
      .strip button.flash {
        opacity: 0.4;
      }

      /* icon key (mute) */
      .key {
        width: var(--fib-hit);
        height: var(--fib-hit);
        flex: none;
        border: 1px solid var(--color-line);
        border-radius: 12px;
        background: var(--color-card2);
        color: var(--color-ink2);
        cursor: pointer;
        display: grid;
        place-items: center;
      }
      .key:active,
      .key.on {
        background: var(--color-accentbg);
        border-color: var(--color-accentline);
        color: var(--color-accent);
      }
      .pct {
        width: 38px;
        flex: none;
        text-align: right;
        font-size: 11.5px;
        color: var(--color-muted);
        font-variant-numeric: tabular-nums;
      }
      /* stepper: same row shape as the slider when the device reports no level */
      .steps {
        flex: 1;
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        border: 1px solid var(--color-line);
        border-radius: 14px;
        overflow: hidden;
        background: var(--color-card2);
      }
      .steps button {
        border: 0;
        background: transparent;
        color: var(--color-ink2);
        cursor: pointer;
        min-height: var(--fib-hit);
        display: grid;
        place-items: center;
      }
      .steps button:active {
        background: var(--color-accentbg);
        color: var(--color-accent);
      }
      .steps .lab {
        font: 600 9.5px/1 inherit;
        letter-spacing: 0.14em;
        color: var(--color-muted);
        padding: 0 12px;
        border-inline: 1px solid var(--color-line);
        align-self: stretch;
        display: grid;
        place-items: center;
      }
      .key fib-icon,
      .strip fib-icon,
      .steps fib-icon {
        --mdc-icon-size: 20px;
        width: 20px;
        height: 20px;
      }

      /* companion panel (sources) — fills the second column on a wide card */
      .panel {
        display: grid;
        gap: 11px;
        align-content: start;
        min-width: 0;
      }
    `,
  ];

  /** HA calls this to seed a fresh card — pick a real remote so the default isn't empty. */
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

  /**
   * Validate + normalise the config into a device list; throws on a bad device so
   * the editor surfaces it. Restores the remembered device selection.
   */
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
    this._resetTransient();

    // Restore the remembered device (keyed on the list, so adding a device doesn't
    // restore a stale index). A restore suppresses auto_select.
    this._sel = 0;
    this._restored = false;
    if (config.remember !== false) {
      const saved = store.get(this._persistKey(), null);
      if (Number.isInteger(saved) && saved >= 0 && saved < devices.length) {
        this._sel = saved;
        this._restored = true;
      }
    }

    // Construct the hold once and reuse it — a fresh controller per setConfig (HA
    // calls it per editor keystroke) would stack controllers on the element.
    if (!this._volHold) this._volHold = new SliderHold(this, { tolerance: 2 });
    else this._volHold.clear();
  }

  _resetTransient() {
    this._dragging = false;
    this._dragVol = 0;
    this._srcOpen = false;
    this._flash = null;
    this._sw = null; // an in-flight swipe must not carry across a device switch
  }

  _persistKey() {
    const ids = this._devices.map((d) => d.entity || d.media_player || d.name);
    return `fibbers:remote:${ids.join("|")}`;
  }

  /** Release a held button when the tab hides, so a long-press can't keep firing in the background. */
  connectedCallback() {
    super.connectedCallback();
    this._onHidden = () => {
      if (document.hidden) this._release();
    };
    document.addEventListener("visibilitychange", this._onHidden);
  }
  /** Tear down the repeat timer, flash timer and visibility listener on unmount. */
  disconnectedCallback() {
    super.disconnectedCallback();
    this._release(); // a held button must not keep firing after unmount
    clearTimeout(this._flashTimer);
    document.removeEventListener("visibilitychange", this._onHidden);
  }

  /** Re-resolve the platform when hass/device changes, and apply one-shot `auto_select: playing`. */
  updated(changed) {
    if (changed.has("hass") || changed.has("_sel")) this._resolvePlatform();
    // `auto_select: playing` applies once, on mount only — never mid-session (which
    // would yank the card out from under a thumb when a speaker starts playing) and
    // never over a remembered selection or an editor keystroke.
    if (
      !this._autoDone &&
      this.hass &&
      !this._restored &&
      this._config.auto_select === "playing"
    ) {
      this._autoDone = true;
      const i = this._devices.findIndex((d) => {
        const mp = d.media_player && this.hass.states[d.media_player];
        return mp && mp.state === "playing";
      });
      if (i >= 0) this._select(i);
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
  // warn once per key, and flash the button — a dead remote shouldn't look
  // identical to a working one. `id` is captured before the await so a rejection
  // that resolves after a device switch flashes/warns the right device, not the
  // one now on screen.
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
      this._flashFail(id, key, e, cmd);
    }
  }

  _flashFail(id, key, e, cmd) {
    const warnKey = `${id}:${key}`;
    if (!this._warned.has(warnKey)) {
      this._warned.add(warnKey);
      console.warn(
        `[fibbers-remote] command "${cmd || key}" was rejected by ${id} ` +
          `(platform: ${this._platform.get(id) || "unknown"}). ${e && e.message ? e.message : e}`,
      );
    }
    // Don't flash a device we've since switched away from.
    if (id !== this._dev().entity) return;
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
    return this.hass
      .callService("remote", svc, { entity_id: id })
      .catch((e) => this._flashFail(id, "power", e, `remote.${svc}`));
  }

  // Returns the call promise so callers can react to a rejection (a stuck optimistic
  // value on volume_set, mostly). Fire-and-forget callers use `_mpDo`.
  _mpService(service, data) {
    const mp = this._mp();
    if (!mp || !this.hass) return Promise.resolve();
    return Promise.resolve(
      this.hass.callService("media_player", service, {
        entity_id: mp.entity_id,
        ...data,
      }),
    );
  }
  // Fire-and-forget media_player call; swallow the rejection so it isn't unhandled.
  _mpDo(service, data) {
    this._mpService(service, data).catch(() => {});
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
    // A rejected volume_set would otherwise leave the optimistic value on screen for
    // the full hold timeout — release it instead.
    this._mpService("volume_set", { volume_level: pct / 100 }).catch(() =>
      this._volHold.clear(),
    );
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

  // Keyboard for the swipe surface (which has no arrow buttons to Tab to). Only
  // acts on the container's own key events — a keydown bubbling up from a focused
  // sector is handled by that sector, not stolen here.
  _dpadKey(e) {
    if (e.target !== e.currentTarget) return;
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

  // --- render helpers ------------------------------------------------

  _switcher(hl) {
    if (this._devices.length <= 1) return "";
    return html`<div
      class="rail"
      role="tablist"
      aria-label=${t(hl, "remote.devices")}
      @keydown=${this._switcherKey}
    >
      ${this._devices.map((d, i) => {
        const sel = i === this._sel;
        return html`<button
          type="button"
          role="tab"
          id="fibtab-${i}"
          class=${this._onState(d) ? "live" : nothing}
          aria-selected=${sel ? "true" : "false"}
          aria-controls="fibpanel"
          tabindex=${sel ? 0 : -1}
          @click=${() => this._select(i)}
        >
          <span class="dot"></span>
          <span class="nm">${d.name || `#${i + 1}`}</span>
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
    return html`<div class="head">
      <div class="badge ${on ? "" : "off"}">
        <fib-icon
          class="h-[19px] w-[19px] [--mdc-icon-size:19px]"
          icon=${this._iconOf(d)}
        ></fib-icon>
      </div>
      <div class="who">
        <b>${d.name || t(hl, "remote.default_name")}</b>
        <span>${nowLine}</span>
      </div>
      ${
        d.entity
          ? html`<button
              type="button"
              class="power ${on ? "on" : ""}"
              aria-label="Power"
              @click=${() => this._power()}
            >
              <fib-icon
                class="h-5 w-5 [--mdc-icon-size:20px]"
                icon="solar:power-bold-duotone"
              ></fib-icon>
            </button>`
          : ""
      }
    </div>`;
  }

  _dpad() {
    const has = (k) => !!this._cmd(k);
    // No directional commands (a speaker, or generic with none) → no d-pad.
    if (!["up", "down", "left", "right", "ok"].some(has)) return "";
    const mode =
      this._dev().dpad || (this._device() === "appletv" ? "both" : "buttons");
    return mode === "grid" ? this._pad(has) : this._wheel(has, mode);
  }

  // The SVG donut. Sectors are individually focusable buttons (native Enter/Space);
  // `swipe`/`both` add a swipe surface (from the gaps and hub) + arrow-key handling.
  _wheel(has, mode) {
    const swipe = mode === "swipe" || mode === "both";
    // On a swipe surface a tap on a sector must not also trigger the container swipe.
    const stop = swipe ? (e) => e.stopPropagation() : undefined;
    const sector = (k, label) =>
      has(k)
        ? svg`<path
            class="seg ${this._flash === k ? "flash" : ""}"
            d=${SEG[k].d}
            role="button"
            tabindex="0"
            aria-label=${label}
            @click=${() => this._send(k)}
            @keydown=${activateOnKey(() => this._send(k))}
            @pointerdown=${stop}
          ></path>
          <path
            class="glyph"
            d=${CHEV[k]}
            transform="translate(${SEG[k].ix},${SEG[k].iy})"
          ></path>`
        : nothing;
    return html`<svg
      class="wheel"
      viewBox="-104 -104 208 208"
      role="group"
      aria-label=${
        swipe
          ? "Direction pad — tap a sector, swipe, or use the arrow keys"
          : "Direction pad"
      }
      tabindex=${swipe ? 0 : nothing}
      @keydown=${swipe ? this._dpadKey : nothing}
      @pointerdown=${swipe ? this._swipeStart : nothing}
      @pointerup=${swipe ? this._swipeEnd : nothing}
      @pointercancel=${swipe ? () => (this._sw = null) : nothing}
    >
      ${sector("up", "Up")}${sector("right", "Right")}${sector("down", "Down")}${sector(
        "left",
        "Left",
      )}
      ${
        has("ok")
          ? svg`<circle
              class="hub"
              cx="0"
              cy="0"
              r="35"
              role="button"
              tabindex="0"
              aria-label="OK"
              @click=${() => this._send("ok")}
              @keydown=${activateOnKey(() => this._send("ok"))}
              @pointerdown=${stop}
            ></circle>
            <text class="hubtx" x="0" y="1">OK</text>`
          : nothing
      }
    </svg>`;
  }

  // 3×3 grid alternative: up/left/OK/right/down, empty corners; every cell ≥44px.
  _pad(has) {
    const cell = (k, label) =>
      has(k)
        ? html`<button
            type="button"
            aria-label=${label}
            class=${this._flash === k ? "flash" : ""}
            @click=${() => this._send(k)}
          >
            <fib-icon
              class="h-5 w-5 [--mdc-icon-size:20px]"
              icon=${ARROW[k]}
            ></fib-icon>
          </button>`
        : html`<span class="blank"></span>`;
    return html`<div class="pad" role="group" aria-label="D-pad">
      <span class="blank"></span>${cell("up", "Up")}<span class="blank"></span>
      ${cell("left", "Left")}
      ${
        has("ok")
          ? html`<button
              type="button"
              class="ok"
              aria-label="OK"
              @click=${() => this._send("ok")}
            >
              OK
            </button>`
          : html`<span class="blank"></span>`
      }
      ${cell("right", "Right")}
      <span class="blank"></span>${cell("down", "Down")}<span
        class="blank"
      ></span>
    </div>`;
  }

  // One segmented strip for transport + navigation. Each cell is gated on the
  // capability that would actually run it: the media_player feature bit if the call
  // will route there, else the remote command. Play/pause takes PLAY or PAUSE.
  _transport() {
    const mp = this._mp();
    const playIcon =
      mp && mp.state === "playing"
        ? "solar:pause-bold-duotone"
        : "solar:play-bold-duotone";
    const canPlayMp =
      mp && (this._mpSupports(mp, MF_PLAY) || this._mpSupports(mp, MF_PAUSE));
    // Prefer the media_player path only when it advertises the bit; else the remote
    // command; else the cell doesn't render.
    const tp = (label, icon, key, mpService, viaMp, cls = "") => {
      if (!viaMp && !this._cmd(key)) return nothing;
      const onClick = viaMp
        ? () => this._mpDo(mpService)
        : () => this._send(key);
      return html`<button
        type="button"
        class="${cls} ${this._flash === key ? "flash" : ""}"
        aria-label=${label}
        @click=${onClick}
      >
        <fib-icon icon=${icon}></fib-icon>
      </button>`;
    };
    const navBtn = (label, icon, key) =>
      this._cmd(key)
        ? html`<button
            type="button"
            class=${this._flash === key ? "flash" : ""}
            aria-label=${label}
            @click=${() => this._send(key)}
          >
            <fib-icon icon=${icon}></fib-icon>
          </button>`
        : nothing;
    // Apple TV aliases Back → menu; render Menu only when it's a distinct command.
    const showMenu =
      this._cmd("menu") && this._cmd("menu") !== this._cmd("back");
    const cells = [
      tp(
        "Previous",
        "solar:skip-previous-bold-duotone",
        "previous",
        "media_previous_track",
        mp && this._mpSupports(mp, MF_PREV),
      ),
      tp("Play / pause", playIcon, "play", "media_play_pause", canPlayMp, "pp"),
      tp(
        "Next",
        "solar:skip-next-bold-duotone",
        "next",
        "media_next_track",
        mp && this._mpSupports(mp, MF_NEXT),
      ),
      navBtn("Back", "solar:arrow-left-bold-duotone", "back"),
      navBtn("Home", "solar:home-2-bold-duotone", "home"),
      showMenu
        ? navBtn("Menu", "solar:menu-dots-bold-duotone", "menu")
        : nothing,
    ].filter((c) => c !== nothing);
    if (!cells.length) return "";
    return html`<div class="strip">${cells}</div>`;
  }

  // One row shape whether or not the device reports a level, so nothing jumps when a
  // TV sleeps: mute key · slider-or-stepper · percentage. Gated on `volume_level`
  // (not the VOLUME_SET bit — a player can advertise it and never report a level).
  _volRow(hl) {
    const mp = this._mp();
    const hasSlider = mp && mp.attributes.volume_level != null;
    const remoteVol = !!this._cmd("volume_up");
    const mpStep = this._mpSupports(mp, MF_VOLUME_STEP);
    if (!hasSlider && !remoteVol && !mpStep) return "";
    const muted = mp && mp.attributes.is_volume_muted;
    const canMute = hasSlider
      ? this._mpSupports(mp, MF_VOLUME_MUTE)
      : remoteVol
        ? !!this._cmd("volume_mute")
        : this._mpSupports(mp, MF_VOLUME_MUTE);
    const muteClick = remoteVol
      ? () => this._send("volume_mute")
      : () => this._mpDo("volume_mute", { is_volume_muted: !muted });
    const mute = canMute
      ? html`<button
          type="button"
          class="key ${muted ? "on" : ""}"
          aria-label=${t(hl, "remote.mute")}
          aria-pressed=${muted ? "true" : "false"}
          @click=${muteClick}
        >
          <fib-icon
            icon=${
              muted
                ? "solar:volume-cross-bold-duotone"
                : "solar:volume-small-bold-duotone"
            }
          ></fib-icon>
        </button>`
      : "";
    return html`<div class="row">
      ${mute}${this._volMid(mp, hasSlider, remoteVol, hl)}
    </div>`;
  }

  _volMid(mp, hasSlider, remoteVol, hl) {
    if (hasSlider) {
      // If the player drops out mid-hold, release the optimistic value.
      const gone = !mp || GONE_STATES.includes(mp.state);
      const vol = this._volHold.value(
        Math.round(mp.attributes.volume_level * 100),
        { dragging: this._dragging, dragValue: this._dragVol, gone },
      );
      return html`${sliderTrack({
          pct: vol,
          disabled: gone,
          cls: "flex-1",
          label: t(hl, "remote.volume"),
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
        })}<span class="pct">${vol}%</span>`;
    }
    // No level: a − VOL + stepper that keeps the row's height and anatomy.
    const down = remoteVol
      ? () => this._send("volume_down")
      : () => this._mpDo("volume_down");
    const up = remoteVol
      ? () => this._send("volume_up")
      : () => this._mpDo("volume_up");
    return html`<div class="steps">
        <button type="button" aria-label="Volume down" @click=${down}>
          <fib-icon icon="solar:minus-circle-bold-duotone"></fib-icon>
        </button>
        <span class="lab">VOL</span>
        <button type="button" aria-label="Volume up" @click=${up}>
          <fib-icon icon="solar:add-circle-bold-duotone"></fib-icon>
        </button>
      </div>
      <span class="pct"></span>`;
  }

  _channelRow() {
    if (!this._cmd("channel_up")) return "";
    return html`<div class="steps">
      <button
        type="button"
        aria-label="Channel down"
        @pointerdown=${() => this._hold(() => this._send("channel_down"))}
        @pointerup=${() => this._release()}
        @pointercancel=${() => this._release()}
        @pointerleave=${() => this._release()}
        @lostpointercapture=${() => this._release()}
        @click=${(e) => e.detail === 0 && this._send("channel_down")}
      >
        <fib-icon icon="solar:minus-circle-bold-duotone"></fib-icon>
      </button>
      <span class="lab">CH</span>
      <button
        type="button"
        aria-label="Channel up"
        @pointerdown=${() => this._hold(() => this._send("channel_up"))}
        @pointerup=${() => this._release()}
        @pointercancel=${() => this._release()}
        @pointerleave=${() => this._release()}
        @lostpointercapture=${() => this._release()}
        @click=${(e) => e.detail === 0 && this._send("channel_up")}
      >
        <fib-icon icon="solar:add-circle-bold-duotone"></fib-icon>
      </button>
    </div>`;
  }

  // Source chips — gated on SELECT_SOURCE so a player that lists sources it can't
  // actually switch doesn't render dead controls.
  _sources(hl) {
    const mp = this._mp();
    if (!mp || !this._mpSupports(mp, MF_SELECT_SOURCE)) return "";
    const all = this._allSources();
    if (!all.length) return "";
    return overflowChips({
      hl,
      all,
      collapsed: this._favSources(all),
      activeValue: mp.attributes.source,
      open: this._srcOpen,
      onToggle: () => {
        this._srcOpen = !this._srcOpen;
      },
      onSelect: (s) =>
        this._mpDo("select_source", { source: s.source || s.name }),
    });
  }

  /** Draw the card: optional switcher, header, d-pad, transport, volume, channel and sources. */
  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const multi = this._devices.length > 1;
    const sources = this._sources(hl);
    const two = !!sources;

    return html`<div
      class="card rounded-[14px] border border-line bg-card p-[13px]
             ${this._unavail() ? "opacity-50" : ""}"
    >
      <div class="layout ${two ? "two" : ""}">
        <div
          class="body"
          role=${multi ? "tabpanel" : nothing}
          id=${multi ? "fibpanel" : nothing}
          aria-labelledby=${multi ? `fibtab-${this._sel}` : nothing}
        >
          ${this._switcher(hl)} ${this._header(hl)} ${this._dpad()}
          ${this._transport()} ${this._volRow(hl)} ${this._channelRow()}
        </div>
        ${two ? html`<div class="panel">${sources}</div>` : ""}
      </div>
    </div>`;
  }

  _needsDpad() {
    // A device with a remote entity gets a d-pad; speaker-only devices don't.
    return !!(this._devices && this._devices.some((d) => d.entity));
  }
  /** Masonry height hint — wheel + transport + volume ≈ 4 rows. */
  getCardSize() {
    return 4;
  }
  /** Sections-view layout: full-width when there's a d-pad, else a narrow speaker column. */
  getLayoutOptions() {
    return { grid_columns: this._needsDpad() ? "full" : 6, grid_rows: "auto" };
  }
  /** Grid-view sizing: wide for a d-pad, narrower for a speaker-only remote. */
  getGridOptions() {
    return this._needsDpad()
      ? { columns: 12, rows: "auto", min_columns: 6 }
      : { columns: 6, rows: "auto", min_columns: 4 };
  }
}
