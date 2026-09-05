/* ================================================================== *
 * fibbers-remote — a real TV/speaker remote over `remote.send_command`, with the
 * correct command names per platform (derived from the entity's integration:
 * apple_tv → pyatv lowercase, philips_js → Cursor…/Standby, Android TV → DPAD_…);
 * `device:` overrides the guess, `commands:` overrides per key. Point `media_player:`
 * at the player for now-playing, source chips and a volume slider.
 *
 * Flat, Fibbers-native design: card2 surfaces, 1px lines, 14px radii, accent green
 * only where something is live. The d-pad is one SVG donut with four true annular
 * sectors (no clip-path corner-clipping); below it the controls sit in separate,
 * well-spaced groups — navigation (back/home/menu), media transport (prev/play/next),
 * then volume — so nav never reads as "part of" transport. Volume is a real slider
 * when the player reports a level, else a slider-shaped scrub strip (drag to change).
 * An optional per-device `controls:` list surfaces extra entities the remote can't
 * infer — a picture-style select → chips, a light/number → slider, a switch → toggle.
 * One card holds several `devices:` behind a segmented tablist; a legacy top-level
 * `entity:`/`media_player:` normalises to a single-device, switcher-less card.
 * ================================================================== */
import {
  LitElement,
  html,
  svg,
  unsafeCSS,
  nothing,
  type TemplateResult,
  type PropertyValues,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { t } from "@shared/i18n";
import { twSheet } from "@shared/tw";
import {
  sliderTrack,
  sliderDrag,
  overflowChips,
  activateOnKey,
  pillSwitch,
  SliderHold,
  type SliderDragHandlers,
  type ChipItem,
} from "@shared/ui";
import {
  pickEntity,
  pctFromX,
  isUnavail,
  store,
  debounce,
  clamp,
  fmtNum,
  capturePointer,
  type Debounced,
} from "@shared/util";
import { card, cx } from "@shared/variants";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
  LovelaceCardConfig,
} from "@/types/home-assistant";
// Real component CSS (SVG donut sectors, container queries, hover chains) — genuinely
// CSS-shaped styling utilities can't express. Vite inlines it; one-file bundle unchanged.
import remoteCss from "./remote.css?inline";
import "@shared/icon";

// Per-platform command names. A key absent here (and from `commands:`) means the
// device can't do it, so that control doesn't render.
const COMMANDS: Record<string, Record<string, string>> = {
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

const PLATFORM_DEVICE: Record<string, string> = {
  apple_tv: "appletv",
  philips_js: "philips",
  androidtv: "androidtv", // the media_player platform
  androidtv_remote: "androidtv", // the remote.* platform that uses these keycodes
};

const DEVICE_ICON: Record<string, string> = {
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

// Optional `controls:` panel — surface extra entities the remote can't infer (a
// picture-style select, a brightness slider, a screen-off switch). Entity domain →
// render kind; `type:` on the control overrides. Slider kinds (light/number) get a
// per-entity SliderHold + drag gesture built in setConfig.
const CONTROL_TYPE: Record<string, string> = {
  select: "select",
  input_select: "select",
  light: "light",
  number: "number",
  input_number: "number",
  switch: "toggle",
  input_boolean: "toggle",
  button: "button",
  scene: "scene",
};
const CONTROL_TYPES = [
  "select",
  "light",
  "number",
  "toggle",
  "button",
  "scene",
];
const SLIDER_CONTROLS = ["light", "number"];

// SVG donut geometry (viewBox -104..104): outer radius 100, hub hole 40, four 76°
// sectors on ±90/0/180° with a 7° gap either side; `ix/iy` is the chevron anchor.
const SEG: Record<string, { d: string; ix: number; iy: number }> = {
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
const CHEV: Record<string, string> = {
  up: "M -7 3.5 L 0 -3.5 L 7 3.5",
  down: "M -7 -3.5 L 0 3.5 L 7 -3.5",
  left: "M 3.5 -7 L -3.5 0 L 3.5 7",
  right: "M -3.5 -7 L 3.5 0 L -3.5 7",
};
const ARROW: Record<string, string> = {
  up: "solar:alt-arrow-up-bold-duotone",
  down: "solar:alt-arrow-down-bold-duotone",
  left: "solar:alt-arrow-left-bold-duotone",
  right: "solar:alt-arrow-right-bold-duotone",
};

/** A single extra entity surfaced in the optional `controls:` panel. */
export interface RemoteControl {
  entity: string;
  type?: string;
  name?: string;
  icon?: string;
}

/** One remote device: a remote entity and/or a media_player, plus per-device options. */
export interface RemoteDevice {
  entity?: string;
  media_player?: string;
  name?: string;
  icon?: string;
  device?: string;
  commands?: Record<string, string>;
  dpad?: string;
  sources?: "auto" | (string | ChipItem)[];
  favourites?: string[];
  controls?: RemoteControl[];
}

/** YAML/editor config accepted by `fibbers-remote`. */
export interface RemoteConfig extends LovelaceCardConfig, RemoteDevice {
  devices?: RemoteDevice[];
  remember?: boolean;
  auto_select?: string;
  language?: string;
}

// A per-entity slider controller (hold + drag gesture + debounced write) for a
// light/number control. Kept in _ctlSliders, keyed by entity.
interface CtlSlider {
  hold: SliderHold;
  dragging: boolean;
  dragVal: number;
  debounced: Debounced<[number]>;
  drag: SliderDragHandlers;
}

/**
 * fibbers-remote — a TV/speaker remote over `remote.send_command` with per-platform
 * command names derived from the entity's integration; holds several `devices:` and
 * switches between them with a segmented tablist.
 */
@customElement("fibbers-remote")
export class FibbersRemote extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config!: RemoteConfig;

  @state() private _sel = 0;

  @state() private _dragging = false;

  @state() private _dragVol = 0;

  @state() private _srcOpen = false;

  @state() private _flash: string | null = null;

  private _devices: RemoteDevice[] = [];

  private _platform = new Map<string, string>();

  private _tried = new Set<string>();

  private _warned = new Set<string>();

  private _restored = false;

  private _autoDone = false;

  private _volHold?: SliderHold;

  private _volInput!: Debounced<[number]>;

  private _volDrag!: SliderDragHandlers;

  private _ctlOpen = new Map<string, boolean>();

  private _ctlSliders = new Map<string, CtlSlider>();

  private _sw: { x: number; y: number } | null = null;

  private _scrub: { lastX: number; moved: boolean } | null = null;

  private _scrubLock = false;

  private _scrubLockT?: ReturnType<typeof setTimeout>;

  private _repeat: ReturnType<typeof setInterval> | null = null;

  private _flashTimer?: ReturnType<typeof setTimeout>;

  private _onHidden?: () => void;

  static styles = [twSheet, unsafeCSS(remoteCss)];

  /** HA calls this to seed a fresh card — pick a real remote so the default isn't empty. */
  static getStubConfig(
    _hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[],
  ): RemoteConfig {
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
  setConfig(config: RemoteConfig): void {
    if (!config) throw new Error("fibbers-remote: config is required");
    // Normalise to a device list: `devices:` if given, else the legacy flat config
    // as a single device. A one-device card renders no switcher.
    const devices: RemoteDevice[] =
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
      if (d.controls != null) {
        if (!Array.isArray(d.controls)) {
          throw new Error(
            `fibbers-remote: device[${i}] \`controls\` must be a list`,
          );
        }
        d.controls.forEach((c, j) => {
          if (!c || typeof c.entity !== "string") {
            throw new Error(
              `fibbers-remote: device[${i}].controls[${j}] needs an \`entity\``,
            );
          }
          if (c.type != null && !CONTROL_TYPES.includes(c.type)) {
            throw new Error(
              `fibbers-remote: \`controls[].type\` must be one of ${CONTROL_TYPES.join(", ")}`,
            );
          }
        });
      }
    });

    this.config = config;
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
      const saved = store.get<number | null>(this._persistKey(), null);
      if (Number.isInteger(saved) && saved! >= 0 && saved! < devices.length) {
        this._sel = saved!;
        this._restored = true;
      }
    }

    // Construct the hold once and reuse it — a fresh controller per setConfig (HA
    // calls it per editor keystroke) would stack controllers on the element.
    if (!this._volHold) this._volHold = new SliderHold(this, { tolerance: 2 });
    else this._volHold.clear();
    this._volInput = debounce((v: number) => this._setVol(v), 150);
    // Shared drag gesture: live-track past the slop, final value wins on release.
    this._volDrag = sliderDrag({
      read: (e) => Math.round(pctFromX(e.clientX, e.currentTarget as Element)),
      frame: (v, dragging) => {
        this._dragging = dragging;
        if (v != null) this._dragVol = v;
      },
      live: (v) => this._volInput(v),
      end: (v) => {
        if (v == null) {
          this._volInput.cancel();
          return;
        }
        this._volInput(v);
        this._volInput.flush();
      },
    });

    // Controls panel: per-select drawer state + per-slider (light/number) hold + drag
    // gesture. Reuse existing controllers by entity so HA's per-keystroke setConfig
    // can't stack a fresh SliderHold on the host; drop controllers for entities that
    // are no longer configured.
    this._ctlOpen = this._ctlOpen || new Map();
    this._ctlSliders = this._ctlSliders || new Map();
    const wanted = new Set<string>();
    for (const d of devices) {
      for (const c of d.controls || []) {
        const kind = c.type || CONTROL_TYPE[String(c.entity).split(".")[0]];
        if (SLIDER_CONTROLS.includes(kind)) {
          wanted.add(c.entity);
          if (!this._ctlSliders.has(c.entity)) {
            this._ctlSliders.set(c.entity, this._makeCtlSlider(c.entity));
          }
        }
      }
    }
    for (const [entity, s] of this._ctlSliders) {
      if (wanted.has(entity)) continue;
      s.debounced.cancel();
      if (this.removeController) this.removeController(s.hold);
      this._ctlSliders.delete(entity);
    }
  }

  // A per-entity slider controller (hold + drag gesture + debounced write) for a
  // light/number control. Kept in _ctlSliders, keyed by entity.
  private _makeCtlSlider(entity: string): CtlSlider {
    const hold = new SliderHold(this, { tolerance: 1, timeout: 2000 });
    const s: CtlSlider = {
      hold,
      dragging: false,
      dragVal: 0,
      debounced: debounce((v: number) => this._ctlSet(entity, v), 150),
      drag: sliderDrag({
        guard: () => isUnavail(this.hass && this.hass.states[entity]),
        read: (e) =>
          this._ctlValFromX(entity, e.clientX, e.currentTarget as Element),
        frame: (v, dragging) => {
          s.dragging = dragging;
          if (v != null) s.dragVal = v;
          this.requestUpdate();
        },
        live: (v) => s.debounced(v),
        end: (v) => {
          if (v == null) {
            s.debounced.cancel();
            return;
          }
          s.debounced(v);
          s.debounced.flush();
        },
      }),
    };
    return s;
  }

  private _resetTransient(): void {
    this._dragging = false;
    this._dragVol = 0;
    this._srcOpen = false;
    this._flash = null;
    this._sw = null; // an in-flight swipe must not carry across a device switch
    // A pending debounced volume write resolves _mp() at fire time — cancel it, and
    // abort any in-flight drag, so a value meant for device A can't land on B.
    if (this._volDrag) this._volDrag.abort();
    if (this._volInput) this._volInput.cancel();
    // Drop any in-flight scrub gesture + its throttle timer / hold-repeat.
    this._scrub = null;
    this._scrubLock = false;
    clearTimeout(this._scrubLockT);
    this._release();
  }

  private _persistKey(): string {
    const ids = this._devices.map((d) => d.entity || d.media_player || d.name);
    return `fibbers:remote:${ids.join("|")}`;
  }

  /** Release a held button when the tab hides, so a long-press can't keep firing in the background. */
  connectedCallback(): void {
    super.connectedCallback();
    this._onHidden = () => {
      if (document.hidden) this._release();
    };
    document.addEventListener("visibilitychange", this._onHidden);
  }

  /** Tear down the repeat timer, flash timer, pending volume write and visibility listener. */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._release(); // a held button must not keep firing after unmount
    clearTimeout(this._flashTimer);
    clearTimeout(this._scrubLockT);
    if (this._volInput) this._volInput.cancel();
    if (this._ctlSliders)
      for (const s of this._ctlSliders.values()) s.debounced.cancel();
    if (this._onHidden)
      document.removeEventListener("visibilitychange", this._onHidden);
  }

  /** Re-resolve the platform when hass/device changes, and apply one-shot `auto_select: playing`. */
  updated(changed: PropertyValues): void {
    if (changed.has("hass") || changed.has("_sel")) this._resolvePlatform();
    // `auto_select: playing` applies once, on mount only — never mid-session (which
    // would yank the card out from under a thumb when a speaker starts playing) and
    // never over a remembered selection or an editor keystroke.
    if (
      !this._autoDone &&
      this.hass &&
      !this._restored &&
      this.config.auto_select === "playing"
    ) {
      this._autoDone = true;
      const { hass } = this;
      const i = this._devices.findIndex((d) => {
        const mp = d.media_player && hass.states[d.media_player];
        return mp && mp.state === "playing";
      });
      if (i >= 0) this._select(i);
    }
  }

  // Resolve the current device's integration once, so the default command family is
  // right without the user picking. Unknown platform → generic (needs `commands:`).
  private async _resolvePlatform(): Promise<void> {
    const d = this._dev();
    if (!d || !d.entity) return;
    const id = d.entity;
    if (this._tried.has(id) || !this.hass || !this.hass.callWS) return;
    this._tried.add(id);
    try {
      const reg = await this.hass.callWS<{ platform?: string }>({
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

  private _dev(): RemoteDevice {
    return (this._devices && this._devices[this._sel]) || {};
  }

  private _select(i: number): void {
    if (i === this._sel || i < 0 || i >= this._devices.length) return;
    // Nothing from the old device may bleed onto the new one.
    this._release();
    if (this._volHold) this._volHold.clear();
    this._resetTransient();
    this._sel = i;
    if (this.config.remember !== false) store.set(this._persistKey(), i);
  }

  private _kindOf(d: RemoteDevice): string {
    return (
      d.device ||
      (d.entity ? PLATFORM_DEVICE[this._platform.get(d.entity) || ""] : "") ||
      "generic"
    );
  }

  private _device(): string {
    return this._kindOf(this._dev());
  }

  private _iconOf(d: RemoteDevice): string {
    if (d.icon) return d.icon;
    if (!d.entity) return SPEAKER_ICON;
    return DEVICE_ICON[this._kindOf(d)] || DEVICE_ICON.generic;
  }

  private _onState(d: RemoteDevice): boolean {
    const st =
      (d.entity && this.hass && this.hass.states[d.entity]) ||
      (d.media_player && this.hass && this.hass.states[d.media_player]);
    return st ? !OFF_STATES.includes(st.state) : false;
  }

  // The command string for a logical key: `commands:` override, else the device
  // map. undefined → the platform can't do it (button won't render).
  private _cmd(key: string): string | undefined {
    const override = (this._dev().commands || {})[key];
    if (override != null) return override;
    return (COMMANDS[this._device()] || {})[key];
  }

  private _mp(): HassEntity | null {
    const id = this._dev().media_player;
    return id && this.hass ? this.hass.states[id] : null;
  }

  private _st(): HassEntity | null {
    const id = this._dev().entity;
    return id && this.hass ? this.hass.states[id] : null;
  }

  private _mpSupports(mp: HassEntity | null, bit: number): boolean {
    // eslint-disable-next-line no-bitwise -- supported_features is a bitmask
    return (((mp && mp.attributes.supported_features) || 0) & bit) === bit;
  }

  private _unavail(): boolean {
    const d = this._dev();
    return d.entity ? isUnavail(this._st()) : isUnavail(this._mp());
  }

  // --- commands & services -------------------------------------------

  // A rejected send_command dies silently in a fire-and-forget call; catch it,
  // warn once per key, and flash the button — a dead remote shouldn't look
  // identical to a working one. `id` is captured before the await so a rejection
  // that resolves after a device switch flashes/warns the right device, not the
  // one now on screen.
  private async _send(key: string): Promise<void> {
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

  private _flashFail(id: string, key: string, e: unknown, cmd?: string): void {
    const warnKey = `${id}:${key}`;
    if (!this._warned.has(warnKey)) {
      this._warned.add(warnKey);
      console.warn(
        `[fibbers-remote] command "${cmd || key}" was rejected by ${id} ` +
          `(platform: ${this._platform.get(id) || "unknown"}). ${
            e && (e as Error).message ? (e as Error).message : e
          }`,
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
  private _power(): Promise<void> | void {
    if (this._device() !== "appletv") return this._send("power");
    const id = this._dev().entity;
    // eslint-disable-next-line consistent-return -- guard-return mirrors the original
    if (!id || !this.hass || this._unavail()) return;
    const st = this._st();
    const on = st ? !OFF_STATES.includes(st.state) : null;
    let svc: string;
    if (on === null) svc = "toggle";
    else svc = on ? "turn_off" : "turn_on";
    return this.hass
      .callService("remote", svc, { entity_id: id })
      .catch((e) => this._flashFail(id, "power", e, `remote.${svc}`));
  }

  // Returns the call promise so callers can react to a rejection (a stuck optimistic
  // value on volume_set, mostly). Fire-and-forget callers use `_mpDo`.
  private _mpService(
    service: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
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
  private _mpDo(service: string, data?: Record<string, unknown>): void {
    this._mpService(service, data).catch(() => {});
  }

  // Long-press repeat, bounded: ~3/s (not 7/s), capped, and stopped on release /
  // cancel / lost capture / the tab hiding (handled in connectedCallback).
  private _hold(fn: () => void): void {
    if (this._unavail()) return;
    this._release();
    fn();
    let count = 0;
    this._repeat = setInterval(() => {
      count += 1;
      if (count > 40) {
        this._release(); // hard cap ~12s
        return;
      }
      fn();
    }, 300);
  }

  private _release(): void {
    if (this._repeat != null) clearInterval(this._repeat);
    this._repeat = null;
  }

  private _allSources(): ChipItem[] {
    const d = this._dev();
    if (!d.sources) return [];
    const mp = this._mp();
    return d.sources === "auto"
      ? ((mp && mp.attributes.source_list) || []).map((s: string) => ({
          name: s,
          source: s,
        }))
      : d.sources.map((s) =>
          typeof s === "string" ? { name: s, source: s } : s,
        );
  }

  private _favSources(all: ChipItem[]): ChipItem[] | null {
    const favs = this._dev().favourites;
    if (!Array.isArray(favs) || !favs.length) return null;
    const byValue = new Map(all.map((s) => [s.source || s.name, s]));
    return favs.map((f) => byValue.get(f) || { name: f, source: f });
  }

  // --- controls panel (value mapping) --------------------------------

  // Slider value-space for a control: lights are always 0-100 (brightness_pct);
  // numbers use the entity's own min/max/step.
  private _ctlBounds(entity: string): {
    min: number;
    max: number;
    step: number;
  } {
    if (entity.split(".")[0] === "light") return { min: 0, max: 100, step: 1 };
    const st = this.hass && this.hass.states[entity];
    const a = (st && st.attributes) || {};
    const min = Number(a.min != null ? a.min : 0);
    const max = Number(a.max != null ? a.max : 100);
    const raw = Number(a.step);
    const step = Number.isFinite(raw) && raw > 0 ? raw : 1;
    return { min, max: max > min ? max : min + 1, step };
  }

  // The entity's real value in slider-space: a light's brightness_pct (0 when off),
  // else the number's state.
  private _ctlRawValue(entity: string): number {
    const st = this.hass && this.hass.states[entity];
    if (entity.split(".")[0] === "light") {
      if (!st || st.state !== "on") return 0;
      const b = st.attributes.brightness;
      return b != null ? Math.round((b / 255) * 100) : 100;
    }
    const n = Number(st && st.state);
    return Number.isFinite(n) ? n : this._ctlBounds(entity).min;
  }

  private _ctlSnap(entity: string, v: number): number {
    const { min, max, step } = this._ctlBounds(entity);
    const snapped = Math.round((v - min) / step) * step + min;
    return clamp(Number(snapped.toFixed(4)), min, max);
  }

  private _ctlPct(entity: string, v: number): number {
    const { min, max } = this._ctlBounds(entity);
    return clamp(((v - min) / (max - min)) * 100, 0, 100);
  }

  private _ctlValFromX(
    entity: string,
    clientX: number,
    track: Element,
  ): number {
    const { min, max } = this._ctlBounds(entity);
    return this._ctlSnap(
      entity,
      min + (pctFromX(clientX, track) / 100) * (max - min),
    );
  }

  // Display value with the snap-back hold applied (same treatment as the volume/
  // number sliders).
  private _ctlValue(entity: string, s: CtlSlider): number {
    const { min, max, step } = this._ctlBounds(entity);
    // eslint-disable-next-line no-param-reassign -- retune the per-entity hold's tolerance in place
    s.hold.tolerance = Math.max(step / 2, (max - min) / 1000);
    return s.hold.value(this._ctlRawValue(entity), {
      dragging: s.dragging,
      dragValue: s.dragVal,
      gone: isUnavail(this.hass && this.hass.states[entity]),
    });
  }

  // Commit a control slider value: light → turn_on brightness_pct (turn_off at 0),
  // number → set_value. Release the hold on rejection.
  private _ctlSet(entity: string, v: number): void {
    if (!this.hass) return;
    const s = this._ctlSliders.get(entity);
    if (s) s.hold.hold(v);
    const dom = entity.split(".")[0];
    let p: Promise<void>;
    if (dom === "light") {
      p =
        v <= 0
          ? this.hass.callService("light", "turn_off", { entity_id: entity })
          : this.hass.callService("light", "turn_on", {
              entity_id: entity,
              brightness_pct: v,
            });
    } else {
      p = this.hass.callService(dom, "set_value", {
        entity_id: entity,
        value: v,
      });
    }
    Promise.resolve(p).catch(() => s && s.hold.clear());
  }

  // Fire-and-forget service for the non-slider controls (select/toggle/button);
  // swallow the rejection so it isn't unhandled.
  private _ctlDo(
    domain: string,
    service: string,
    data?: Record<string, unknown>,
  ): void {
    if (!this.hass) return;
    Promise.resolve(this.hass.callService(domain, service, data)).catch(
      () => {},
    );
  }

  private _setVol(pct: number): void {
    if (this._volHold) this._volHold.hold(pct);
    // A rejected volume_set would otherwise leave the optimistic value on screen for
    // the full hold timeout — release it instead.
    this._mpService("volume_set", { volume_level: pct / 100 }).catch(() => {
      if (this._volHold) this._volHold.clear();
    });
  }

  // Keyboard for the swipe surface (which has no arrow buttons to Tab to). Only
  // acts on the container's own key events — a keydown bubbling up from a focused
  // sector is handled by that sector, not stolen here.
  private _dpadKey(e: KeyboardEvent): void {
    if (e.target !== e.currentTarget) return;
    const map: Record<string, string> = {
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

  private _swipeStart(e: PointerEvent): void {
    capturePointer(e.currentTarget as Element, e.pointerId);
    this._sw = { x: e.clientX, y: e.clientY };
  }

  private _swipeEnd(e: PointerEvent): void {
    const s = this._sw;
    this._sw = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.hypot(dx, dy) < 24) {
      this._send("ok"); // tap
      return;
    }
    let dir: string;
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? "right" : "left";
    else dir = dy > 0 ? "down" : "up";
    this._send(dir);
  }

  // --- render helpers ------------------------------------------------

  private _switcher(hl: unknown): TemplateResult | string {
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
  private _switcherKey(e: KeyboardEvent): void {
    const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
    const tabs = [
      ...(e.currentTarget as Element).querySelectorAll('[role="tab"]'),
    ];
    const cur = e.composedPath().find((el) => tabs.includes(el as Element));
    const idx = tabs.indexOf(cur as Element);
    if (idx < 0) return;
    let next: number;
    if (e.key in delta) next = (idx + delta[e.key] + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    (tabs[next] as HTMLElement).focus();
    this._select(next);
  }

  private _header(hl: unknown): TemplateResult {
    const d = this._dev();
    const mp = this._mp();
    const on = this._onState(d);
    const onOff = t(hl, on ? "remote.on" : "remote.off");
    let nowLine: string;
    if (mp)
      nowLine =
        mp.attributes.media_title ||
        mp.attributes.app_name ||
        mp.attributes.source ||
        onOff;
    else nowLine = d.entity ? onOff : "";
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

  private _dpad(): TemplateResult | string {
    const has = (k: string): boolean => !!this._cmd(k);
    // No directional commands (a speaker, or generic with none) → no d-pad.
    if (!["up", "down", "left", "right", "ok"].some(has)) return "";
    const mode =
      this._dev().dpad || (this._device() === "appletv" ? "both" : "buttons");
    return mode === "grid" ? this._pad(has) : this._wheel(has, mode);
  }

  // The SVG donut. Sectors are individually focusable buttons (native Enter/Space);
  // `swipe`/`both` add a swipe surface (from the gaps and hub) + arrow-key handling.
  private _wheel(has: (k: string) => boolean, mode: string): TemplateResult {
    const swipe = mode === "swipe" || mode === "both";
    // On a swipe surface a tap on a sector must not also trigger the container swipe.
    const stop = swipe ? (e: Event) => e.stopPropagation() : undefined;
    const sector = (k: string, label: string) =>
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
      @pointercancel=${
        swipe
          ? () => {
              this._sw = null;
            }
          : nothing
      }
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
            <text class="hubtx" x="0" y="1" aria-hidden="true">OK</text>`
          : nothing
      }
    </svg>`;
  }

  // 3×3 grid alternative: up/left/OK/right/down, empty corners; every cell ≥44px.
  private _pad(has: (k: string) => boolean): TemplateResult {
    const cell = (k: string, label: string) =>
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

  // Navigation keys (Back / Home / Menu) as their own labelled row, sitting right
  // under the wheel — nav belongs with the d-pad, not lumped into the transport
  // strip (where Back/Home read as "missing"). Each cell renders only when the
  // device advertises the command; Menu only when it's distinct from Back (Apple TV
  // aliases Back → menu).
  private _nav(hl: unknown): TemplateResult | string {
    const navBtn = (label: string, icon: string, key: string) =>
      this._cmd(key)
        ? html`<button
            type="button"
            class=${this._flash === key ? "flash" : ""}
            aria-label=${label}
            @click=${() => this._send(key)}
          >
            <fib-icon icon=${icon}></fib-icon>${label}
          </button>`
        : nothing;
    const showMenu =
      this._cmd("menu") && this._cmd("menu") !== this._cmd("back");
    const cells = [
      navBtn(t(hl, "remote.back"), "solar:arrow-left-bold-duotone", "back"),
      navBtn(t(hl, "remote.home"), "solar:home-2-bold-duotone", "home"),
      showMenu
        ? navBtn(t(hl, "remote.menu"), "solar:menu-dots-bold-duotone", "menu")
        : nothing,
    ].filter((c) => c !== nothing);
    if (!cells.length) return "";
    return html`<div
      class="navrow"
      role="group"
      aria-label=${t(hl, "remote.navigation")}
    >
      ${cells}
    </div>`;
  }

  // One segmented strip for media transport only (previous · play/pause · next).
  // Each cell is gated on the capability that would actually run it: the media_player
  // feature bit if the call will route there, else the remote command. Play/pause
  // takes PLAY or PAUSE. Navigation (back/home/menu) lives in _nav, not here.
  private _transport(): TemplateResult | string {
    const mp = this._mp();
    const playIcon =
      mp && mp.state === "playing"
        ? "solar:pause-bold-duotone"
        : "solar:play-bold-duotone";
    const canPlayMp =
      mp && (this._mpSupports(mp, MF_PLAY) || this._mpSupports(mp, MF_PAUSE));
    // Prefer the media_player path only when it advertises the bit; else the remote
    // command; else the cell doesn't render.
    const tp = (
      label: string,
      icon: string,
      key: string,
      mpService: string,
      viaMp: boolean | null,
      cls = "",
    ) => {
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
    ].filter((c) => c !== nothing);
    if (!cells.length) return "";
    return html`<div class="strip">${cells}</div>`;
  }

  // One row shape whether or not the device reports a level, so nothing jumps when a
  // TV sleeps: mute key · slider-or-stepper · percentage. Gated on `volume_level`
  // (not the VOLUME_SET bit — a player can advertise it and never report a level).
  private _volRow(hl: unknown): TemplateResult | string {
    const mp = this._mp();
    const hasSlider = mp && mp.attributes.volume_level != null;
    const remoteVol = !!this._cmd("volume_up");
    const mpStep = this._mpSupports(mp, MF_VOLUME_STEP);
    if (!hasSlider && !remoteVol && !mpStep) return "";
    const muted = mp && mp.attributes.is_volume_muted;
    let canMute: boolean;
    if (hasSlider) canMute = this._mpSupports(mp, MF_VOLUME_MUTE);
    else if (remoteVol) canMute = !!this._cmd("volume_mute");
    else canMute = this._mpSupports(mp, MF_VOLUME_MUTE);
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

  private _volMid(
    mp: HassEntity | null,
    hasSlider: boolean | null,
    remoteVol: boolean,
    hl: unknown,
  ): TemplateResult {
    if (hasSlider && mp) {
      // If the player drops out mid-hold, release the optimistic value.
      const gone = !mp || GONE_STATES.includes(mp.state);
      const vol = this._volHold!.value(
        Math.round(mp.attributes.volume_level * 100),
        { dragging: this._dragging, dragValue: this._dragVol, gone },
      );
      return html`${sliderTrack({
          pct: vol,
          disabled: gone,
          dragging: this._dragging,
          cls: "flex-1",
          label: t(hl, "remote.volume"),
          value: vol,
          min: 0,
          max: 100,
          step: 5,
          valueText: `${vol}%`,
          // Keyboard: arm the hold now (display advances, held keys keep stepping)
          // but debounce the write — auto-repeat fired ~30 volume_set calls a
          // second straight at the committer.
          onInput: (v) => {
            this._volHold!.hold(v);
            this._volInput(v);
          },
          onDown: this._volDrag.down,
          onMove: this._volDrag.move,
          onUp: this._volDrag.up,
          onCancel: this._volDrag.cancel,
        })}<span class="pct">${vol}%</span>`;
    }
    // No level to position a thumb at → a slider-shaped scrub strip instead of a
    // cramped stepper: drag to change, tap a side to step, hold to repeat. Full
    // width (no % cell), so nothing jumps if a TV that *did* report a level sleeps.
    return this._volScrub(hl, remoteVol);
  }

  // The scrub strip for a device with no `volume_level`. The two ends are real
  // buttons (Volume down / up): tap steps once, press-and-hold repeats via the shared
  // `_hold`, and keyboard activation (Enter/Space) is native — so a held key can't
  // outrun the throttle. The middle groove is a decorative, aria-hidden drag surface:
  // one step per ~STEP_PX of horizontal drag past the slop, throttled by `_scrubLock`.
  // Routes through the remote command when present, else the media_player VOLUME_STEP
  // service. No absolute position is ever shown: the device reports none.
  private _volScrub(hl: unknown, remoteVol: boolean): TemplateResult {
    const SLOP = 4;
    const STEP_PX = 22;
    const step = (dir: number): void => {
      if (this._unavail()) return;
      const key = dir > 0 ? "volume_up" : "volume_down";
      if (remoteVol) this._send(key);
      else this._mpDo(key);
    };
    // Throttled single step for the keyboard path — a held Enter delivers repeated
    // click events, so gate them the same 120ms as the drag.
    const stepThrottled = (dir: number): void => {
      if (this._scrubLock) return;
      step(dir);
      this._scrubLock = true;
      clearTimeout(this._scrubLockT);
      this._scrubLockT = setTimeout(() => {
        this._scrubLock = false;
      }, 120);
    };
    // Groove drag: horizontal only; vertical gestures are left to the page (pan-y).
    const down = (e: PointerEvent): void => {
      if (this._unavail()) return;
      capturePointer(e.currentTarget as Element, e.pointerId);
      this._scrub = { lastX: e.clientX, moved: false };
      this.requestUpdate(); // reflect the .dragging grip state
    };
    const move = (e: PointerEvent): void => {
      const s = this._scrub;
      if (!s) return;
      if (!s.moved && Math.abs(e.clientX - s.lastX) < SLOP) return;
      s.moved = true;
      if (Math.abs(e.clientX - s.lastX) >= STEP_PX && !this._scrubLock) {
        step(e.clientX > s.lastX ? 1 : -1);
        s.lastX = e.clientX;
        this._scrubLock = true;
        clearTimeout(this._scrubLockT);
        this._scrubLockT = setTimeout(() => {
          this._scrubLock = false;
        }, 120);
      }
    };
    const end = (): void => {
      this._scrub = null;
      this.requestUpdate(); // clear the .dragging grip state
    };
    // Each end button: pointer press repeats via `_hold`; a keyboard Enter/Space
    // arrives as a detail-0 click and steps once (throttled).
    const edge = (dir: number, label: string, icon: string) =>
      html`<button
        type="button"
        class="edge"
        aria-label=${label}
        @pointerdown=${() => this._hold(() => step(dir))}
        @pointerup=${() => this._release()}
        @pointercancel=${() => this._release()}
        @pointerleave=${() => this._release()}
        @lostpointercapture=${() => this._release()}
        @click=${(e: MouseEvent) => e.detail === 0 && stepThrottled(dir)}
      >
        <fib-icon icon=${icon}></fib-icon>
      </button>`;
    return html`<div
      class="scrub ${this._scrub ? "dragging" : ""}"
      role="group"
      aria-label=${t(hl, "remote.volume")}
    >
      ${edge(-1, "Volume down", "solar:volume-small-bold-duotone")}
      <div
        class="groove"
        aria-hidden="true"
        @pointerdown=${down}
        @pointermove=${move}
        @pointerup=${end}
        @pointercancel=${end}
        @lostpointercapture=${end}
      >
        <span class="grip"></span>
      </div>
      ${edge(1, "Volume up", "solar:volume-loud-bold-duotone")}
    </div>`;
  }

  private _channelRow(): TemplateResult | string {
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
        @click=${(e: MouseEvent) => e.detail === 0 && this._send("channel_down")}
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
        @click=${(e: MouseEvent) => e.detail === 0 && this._send("channel_up")}
      >
        <fib-icon icon="solar:add-circle-bold-duotone"></fib-icon>
      </button>
    </div>`;
  }

  // Source chips — gated on SELECT_SOURCE so a player that lists sources it can't
  // actually switch doesn't render dead controls.
  private _sources(hl: unknown): TemplateResult | string {
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

  // The generic controls panel: render each configured control by kind. Skips
  // controls whose entity isn't loaded, so a stale entity id leaves no dead row.
  private _controls(hl: unknown): TemplateResult | string {
    const list = this._dev().controls;
    if (!Array.isArray(list) || !list.length) return "";
    const rows = list
      .map((item) => this._control(hl, item))
      .filter((r) => r !== nothing);
    if (!rows.length) return "";
    return html`<div class="controls">${rows}</div>`;
  }

  private _control(
    hl: unknown,
    item: RemoteControl,
  ): TemplateResult | typeof nothing {
    const st = this.hass && this.hass.states[item.entity];
    if (!st) return nothing;
    const type = item.type || CONTROL_TYPE[item.entity.split(".")[0]];
    const name =
      item.name ||
      (st.attributes && st.attributes.friendly_name) ||
      item.entity;
    switch (type) {
      case "select":
        return this._ctlSelect(hl, item, st, name);
      case "light":
      case "number":
        return this._ctlSlider(item, st, name);
      case "toggle":
        return this._ctlToggle(item, st, name);
      case "button":
      case "scene":
        return this._ctlButton(type, item, name);
      default:
        return nothing;
    }
  }

  // A select/input_select as a chip row (picture-style presets etc.), collapsing to
  // the first few when there are many.
  private _ctlSelect(
    hl: unknown,
    item: RemoteControl,
    st: HassEntity,
    name: string,
  ): TemplateResult | typeof nothing {
    const options = (st.attributes && st.attributes.options) || [];
    if (!options.length) return nothing;
    const all = options.map((o: string) => ({ name: o, source: o }));
    const open = !!this._ctlOpen.get(item.entity);
    const dom = item.entity.split(".")[0];
    return html`<div class="ctl">
      <div class="ctl-lab"><span>${name}</span></div>
      ${overflowChips({
        hl,
        all,
        collapsed: all.length > 8 ? all.slice(0, 6) : null,
        activeValue: st.state,
        open,
        onToggle: () => {
          this._ctlOpen.set(item.entity, !open);
          this.requestUpdate();
        },
        onSelect: (s) =>
          this._ctlDo(dom, "select_option", {
            entity_id: item.entity,
            option: s.source || s.name,
          }),
      })}
    </div>`;
  }

  // A light (brightness) or number as a drag slider, reusing the shared track +
  // per-entity hold/drag built in setConfig.
  private _ctlSlider(
    item: RemoteControl,
    st: HassEntity,
    name: string,
  ): TemplateResult | typeof nothing {
    const { entity } = item;
    const s = this._ctlSliders.get(entity);
    if (!s) return nothing;
    const b = this._ctlBounds(entity);
    const gone = isUnavail(st);
    const v = this._ctlValue(entity, s);
    const valueText =
      entity.split(".")[0] === "light"
        ? `${Math.round(v)}%`
        : fmtNum(this.hass, v, Number.isInteger(b.step) ? 0 : 1);
    return html`<div class="ctl">
      <div class="ctl-lab">
        <span>${name}</span
        ><span class="ctl-val">${gone ? "" : valueText}</span>
      </div>
      ${sliderTrack({
        pct: this._ctlPct(entity, v),
        disabled: gone,
        dragging: s.dragging,
        label: name,
        value: v,
        min: b.min,
        max: b.max,
        step: b.step,
        valueText,
        onInput: (nv) => {
          const sn = this._ctlSnap(entity, nv);
          s.hold.hold(sn);
          s.debounced(sn);
        },
        onDown: s.drag.down,
        onMove: s.drag.move,
        onUp: s.drag.up,
        onCancel: s.drag.cancel,
      })}
    </div>`;
  }

  // A switch/input_boolean as a labelled pill toggle (screen-off etc.).
  private _ctlToggle(
    item: RemoteControl,
    st: HassEntity,
    name: string,
  ): TemplateResult {
    const dom = item.entity.split(".")[0];
    return html`<div class="ctl ctl-row">
      <div class="ctl-lab"><span>${name}</span></div>
      ${pillSwitch({
        on: st.state === "on",
        label: name,
        onClick: () => this._ctlDo(dom, "toggle", { entity_id: item.entity }),
      })}
    </div>`;
  }

  // A button/scene as a single press key.
  private _ctlButton(
    type: string,
    item: RemoteControl,
    name: string,
  ): TemplateResult {
    const dom = item.entity.split(".")[0];
    const service = type === "scene" ? "turn_on" : "press";
    return html`<div class="ctl ctl-row">
      <div class="ctl-lab"><span>${name}</span></div>
      <button
        type="button"
        class="key"
        aria-label=${name}
        @click=${() => this._ctlDo(dom, service, { entity_id: item.entity })}
      >
        <fib-icon icon=${item.icon || "solar:play-bold-duotone"}></fib-icon>
      </button>
    </div>`;
  }

  /** Draw the card: optional switcher, header, d-pad, transport, volume, channel and sources. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const multi = this._devices.length > 1;
    const sources = this._sources(hl);
    const controls = this._controls(hl);
    const two = !!(sources || controls);

    return html`<div
      class=${cx("card", card(), this._unavail() && "opacity-50")}
    >
      <div class="layout ${two ? "two" : ""}">
        <div
          class="body"
          role=${multi ? "tabpanel" : nothing}
          id=${multi ? "fibpanel" : nothing}
          aria-labelledby=${multi ? `fibtab-${this._sel}` : nothing}
        >
          ${this._switcher(hl)} ${this._header(hl)} ${this._dpad()}
          ${this._nav(hl)} ${this._transport()} ${this._volRow(hl)}
          ${this._channelRow()}
        </div>
        ${two ? html`<div class="panel">${sources}${controls}</div>` : ""}
      </div>
    </div>`;
  }

  private _needsDpad(): boolean {
    // A device with a remote entity gets a d-pad; speaker-only devices don't.
    return !!(this._devices && this._devices.some((d) => d.entity));
  }

  /** Masonry height hint — wheel + transport + volume ≈ 4 rows. */
  getCardSize(): number {
    return 4;
  }

  /** Sections-view layout: full-width when there's a d-pad, else a narrow speaker column. */
  getLayoutOptions(): { grid_columns: string | number; grid_rows: string } {
    return { grid_columns: this._needsDpad() ? "full" : 6, grid_rows: "auto" };
  }

  /** Grid-view sizing: wide for a d-pad, narrower for a speaker-only remote. */
  getGridOptions(): {
    columns: number;
    rows: string;
    min_columns: number;
  } {
    return this._needsDpad()
      ? { columns: 12, rows: "auto", min_columns: 6 }
      : { columns: 6, rows: "auto", min_columns: 4 };
  }
}
