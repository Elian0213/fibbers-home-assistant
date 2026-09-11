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
  unsafeCSS,
  nothing,
  type TemplateResult,
  type PropertyValues,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { twSheet } from "@shared/tw";
import { ThemeController } from "@shared/theme-host";
import { setupSlider, type SliderController } from "@shared/ui";
import {
  pickEntity,
  pctFromX,
  isUnavail,
  store,
  capturePointer,
} from "@shared/util";
import { setLightBrightness } from "@shared/actions";
import { card, cx } from "@shared/variants";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
} from "@/types/home-assistant";
// Real component CSS (SVG donut sectors, container queries, hover chains) — genuinely
// CSS-shaped styling utilities can't express. Vite inlines it; one-file bundle unchanged.
import remoteCss from "./remote.css?inline";
import "@shared/icon";
import { OFF_STATES, GONE_STATES, MF_SEEK } from "./const";
import { deviceKind, cmdFor, deviceUnavail, mpSupports } from "./device";
import { ctlBounds, ctlRawValue, ctlSnap, ctlValFromX } from "./ctl-math";
import { livePosition, resolveTouchpadOptions } from "./touchpad-math";
import { TouchpadController, type PlaybackInfo } from "./touchpad-controller";

import {
  validateRemoteConfig,
  sliderControlEntities,
  persistKey,
  type RemoteControl,
  type RemoteDevice,
  type RemoteConfig,
} from "./config";
import type { RemoteHost } from "./host";
import { renderSwitcher, renderHeader } from "./components/header";
import { renderDpad } from "./components/dpad";
import { renderNav, renderTransport } from "./components/transport";
import { renderVolRow, renderChannelRow } from "./components/volume";
import { renderSources, renderControls } from "./components/panel";

// Config shapes live in ./config alongside the pure validator; re-export so the
// module's public type surface is unchanged after the split.
export type { RemoteControl, RemoteDevice, RemoteConfig };

/**
 * fibbers-remote — a TV/speaker remote over `remote.send_command` with per-platform
 * command names derived from the entity's integration; holds several `devices:` and
 * switches between them with a segmented tablist.
 */
@customElement("fibbers-remote")
export class FibbersRemote
  extends LitElement
  implements LovelaceCard, RemoteHost
{
  @property({ attribute: false }) hass?: HomeAssistant;

  _theme = new ThemeController(this);

  @state() private config!: RemoteConfig;

  @state() private _sel = 0;

  @state() private _srcOpen = false;

  @state() private _flash: string | null = null;

  private _devices: RemoteDevice[] = [];

  private _platform = new Map<string, string>();

  private _tried = new Set<string>();

  private _warned = new Set<string>();

  private _restored = false;

  private _autoDone = false;

  private _vol?: SliderController;

  private _touchpad?: TouchpadController;

  private _ctlOpen = new Map<string, boolean>();

  private _ctlSliders = new Map<string, SliderController>();

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
    // Validate + normalise to a device list (throws on a bad device, before any
    // state mutation, so a mid-edit invalid config leaves the working card intact).
    const devices = validateRemoteConfig(config);

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
      const saved = store.get<number | null>(persistKey(devices), null);
      if (Number.isInteger(saved) && saved! >= 0 && saved! < devices.length) {
        this._sel = saved!;
        this._restored = true;
      }
    }

    // Construct the volume control once and reuse it — a fresh SliderHold per
    // setConfig (HA calls it per editor keystroke) would stack controllers on the
    // element. A rejected volume_set releases the optimistic hold automatically.
    if (!this._vol)
      this._vol = setupSlider({
        host: this,
        read: (e) =>
          Math.round(pctFromX(e.clientX, e.currentTarget as Element)),
        base: () => this.volPct(),
        commit: (v) => this._mpService("volume_set", { volume_level: v / 100 }),
        hold: { tolerance: 2 },
      });
    else this._vol.hold.clear();

    // Construct the touchpad controller once (same reason as the volume control).
    // The adapter bridges the element's public API to the controller's TouchpadHost
    // and resolves the current device at call time, so it survives device switches.
    if (!this._touchpad)
      this._touchpad = new TouchpadController({
        addController: (c) => this.addController(c),
        removeController: (c) => this.removeController(c),
        updateComplete: this.updateComplete,
        requestUpdate: () => this.requestUpdate(),
        send: (k) => this.send(k),
        sendHold: (k) => this._sendHold(k),
        holdRepeat: (fn) => this.hold(fn),
        holdRelease: () => this.release(),
        mediaDo: (s, d) => this.mpDo(s, d),
        playback: () => this._playbackInfo(),
        unavail: () => this.unavail(),
        opts: () => resolveTouchpadOptions(this.dev().touchpad),
        debug: () => !!this.config.debug,
      });

    // Controls panel: per-select drawer state + per-slider (light/number) hold + drag
    // gesture. Reuse existing controllers by entity so HA's per-keystroke setConfig
    // can't stack a fresh SliderHold on the host; drop controllers for entities that
    // are no longer configured.
    this._ctlOpen = this._ctlOpen || new Map();
    this._ctlSliders = this._ctlSliders || new Map();
    const wanted = sliderControlEntities(devices);
    for (const entity of wanted) {
      if (!this._ctlSliders.has(entity)) {
        this._ctlSliders.set(entity, this._makeCtlSlider(entity));
      }
    }
    for (const [entity, s] of this._ctlSliders) {
      if (wanted.has(entity)) continue;
      s.dispose();
      if (this.removeController) this.removeController(s.hold);
      this._ctlSliders.delete(entity);
    }
  }

  // A per-entity slider control (hold + drag gesture + debounced write) for a
  // light/number control. Kept in _ctlSliders, keyed by entity.
  private _makeCtlSlider(entity: string): SliderController {
    return setupSlider({
      host: this,
      guard: () => isUnavail(this.hass && this.hass.states[entity]),
      read: (e) =>
        ctlValFromX(this.hass, entity, e.clientX, e.currentTarget as Element),
      base: () => {
        const s = this._ctlSliders.get(entity);
        return s ? this.ctlValue(entity, s) : ctlRawValue(this.hass, entity);
      },
      clampValue: (v) => ctlSnap(this.hass, entity, v),
      commit: (v) => this._ctlSvc(entity, v),
      hold: { tolerance: 1, timeout: 2000 },
    });
  }

  private _resetTransient(): void {
    this._srcOpen = false;
    this._flash = null;
    this._sw = null; // an in-flight swipe must not carry across a device switch
    // A pending debounced volume write resolves _mp() at fire time — cancel it, and
    // abort any in-flight drag, so a value meant for device A can't land on B.
    if (this._vol) {
      this._vol.drag.abort();
      this._vol.dispose();
    }
    // Drop any in-flight scrub gesture + its throttle timer / hold-repeat.
    this._scrub = null;
    this._scrubLock = false;
    clearTimeout(this._scrubLockT);
    this.release();
    // Kill any live touchpad gesture (momentum/scrub/edge-repeat) so nothing bleeds
    // across a device switch (this funnels through _select) or a re-config.
    this._touchpad?.abort();
  }

  /** Release a held button when the tab hides, so a long-press can't keep firing in the background. */
  connectedCallback(): void {
    super.connectedCallback();
    this._onHidden = () => {
      if (document.hidden) {
        this.release();
        this._touchpad?.abort(); // momentum/scrub must not run in a hidden tab
      }
    };
    document.addEventListener("visibilitychange", this._onHidden);
  }

  /** Tear down the repeat timer, flash timer, pending volume write and visibility listener. */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.release(); // a held button must not keep firing after unmount
    clearTimeout(this._flashTimer);
    clearTimeout(this._scrubLockT);
    if (this._vol) this._vol.dispose();
    if (this._ctlSliders)
      for (const s of this._ctlSliders.values()) s.dispose();
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
      if (i >= 0) this.select(i);
    }
  }

  // Resolve the current device's integration once, so the default command family is
  // right without the user picking. Unknown platform → generic (needs `commands:`).
  private async _resolvePlatform(): Promise<void> {
    const d = this.dev();
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

  // --- host contract (getters over @state/private fields) -------------

  /** The configured device list (read-only view for the switcher/header). */
  get devices(): RemoteDevice[] {
    return this._devices;
  }

  /** The selected device index. */
  get sel(): number {
    return this._sel;
  }

  /** The key currently flashing (pressed or rejected), or null. */
  get flash(): string | null {
    return this._flash;
  }

  /** Whether the source-chip overflow drawer is open. */
  get srcOpen(): boolean {
    return this._srcOpen;
  }

  /** The volume slider controller — constructed once in setConfig, before render. */
  get vol(): SliderController {
    return this._vol!;
  }

  /** The touchpad gesture controller — constructed once in setConfig, before render. */
  get touchpad(): TouchpadController {
    return this._touchpad!;
  }

  /** Toggle the source-chip overflow drawer. */
  toggleSrc(): void {
    this._srcOpen = !this._srcOpen;
  }

  // --- current device -------------------------------------------------

  /** The currently-selected device (empty object when none). */
  dev(): RemoteDevice {
    return (this._devices && this._devices[this._sel]) || {};
  }

  /** Switch to device `i`, tearing down anything transient from the old one. */
  select(i: number): void {
    if (i === this._sel || i < 0 || i >= this._devices.length) return;
    // Nothing from the old device may bleed onto the new one.
    this.release();
    if (this._vol) this._vol.hold.clear();
    this._resetTransient();
    this._sel = i;
    if (this.config.remember !== false) store.set(persistKey(this._devices), i);
  }

  /** The command family for a device (explicit `device:`, else resolved platform, else generic). */
  kindOf(d: RemoteDevice): string {
    return deviceKind(d, this._platform);
  }

  private _device(): string {
    return this.kindOf(this.dev());
  }

  /**
   * The command string for a logical key: `commands:` override, else the device
   * map. undefined → the platform can't do it (button won't render).
   */
  cmd(key: string): string | undefined {
    return cmdFor(this.dev(), this._device(), key);
  }

  /** The current device's media_player entity, or null. */
  mp(): HassEntity | null {
    const id = this.dev().media_player;
    return id && this.hass ? this.hass.states[id] : null;
  }

  private _st(): HassEntity | null {
    const id = this.dev().entity;
    return id && this.hass ? this.hass.states[id] : null;
  }

  /** True when the current device's primary entity is unavailable. */
  unavail(): boolean {
    return deviceUnavail(this.hass, this.dev());
  }

  // --- commands & services -------------------------------------------

  /**
   * Send a logical key over `remote.send_command`. A rejected send dies silently
   * in a fire-and-forget call; catch it, warn once per key, and flash the button —
   * a dead remote shouldn't look identical to a working one. `id` is captured
   * before the await so a rejection that resolves after a device switch flashes/
   * warns the right device, not the one now on screen.
   */
  async send(key: string): Promise<void> {
    const cmd = this.cmd(key);
    const id = this.dev().entity;
    if (!cmd || !id || !this.hass || this.unavail()) return;
    try {
      await this.hass.callService("remote", "send_command", {
        entity_id: id,
        command: cmd,
      });
    } catch (e) {
      this._flashFail(id, key, e, cmd);
    }
  }

  // Send a logical key as a long-press: `hold_secs: 1` maps to pyatv InputAction.Hold
  // (Apple TV context menu on `select`). Same resolution/guard/flash path as `send`.
  private _sendHold(key: string): void {
    const cmd = this.cmd(key);
    const id = this.dev().entity;
    if (!cmd || !id || !this.hass || this.unavail()) return;
    Promise.resolve(
      this.hass.callService("remote", "send_command", {
        entity_id: id,
        command: cmd,
        hold_secs: 1,
      }),
    ).catch((e) => this._flashFail(id, key, e, cmd));
  }

  // Live playback for the touchpad scrub gesture: null only when the device has no
  // media_player at all. `seekable` requires the SEEK bit AND a usable position/
  // duration (drift-corrected while playing); unseekable players (Netflix reports
  // no timeline to pyatv) still report their state so the controller can choose
  // the press-scrub transport.
  private _playbackInfo(): PlaybackInfo | null {
    const mp = this.mp();
    if (!mp) return null;
    const a = mp.attributes;
    const updated = a.media_position_updated_at
      ? Date.parse(a.media_position_updated_at)
      : NaN;
    const lp = mpSupports(mp, MF_SEEK)
      ? livePosition(
          Number(a.media_position),
          updated,
          mp.state === "playing",
          Date.now(),
          Number(a.media_duration),
        )
      : null;
    return lp
      ? { state: mp.state, seekable: true, pos: lp.pos, dur: lp.dur }
      : { state: mp.state, seekable: false, pos: NaN, dur: NaN };
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
    if (id !== this.dev().entity) return;
    this._flash = key;
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      this._flash = null;
    }, 500);
  }

  /**
   * Toggle power. Apple TV power lives on the remote's own turn_on/turn_off/toggle
   * services, not in the command map; direction follows the remote's own state.
   */
  power(): Promise<void> | void {
    if (this._device() !== "appletv") return this.send("power");
    const id = this.dev().entity;
    // eslint-disable-next-line consistent-return -- guard-return mirrors the original
    if (!id || !this.hass || this.unavail()) return;
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
    const mp = this.mp();
    if (!mp || !this.hass) return Promise.resolve();
    return Promise.resolve(
      this.hass.callService("media_player", service, {
        entity_id: mp.entity_id,
        ...data,
      }),
    );
  }

  /** Fire-and-forget media_player call; swallow the rejection so it isn't unhandled. */
  mpDo(service: string, data?: Record<string, unknown>): void {
    this._mpService(service, data).catch(() => {});
  }

  /**
   * Long-press repeat, bounded: ~3/s (not 7/s), capped, and stopped on release /
   * cancel / lost capture / the tab hiding (handled in connectedCallback).
   */
  hold(fn: () => void): void {
    if (this.unavail()) return;
    this.release();
    fn();
    let count = 0;
    this._repeat = setInterval(() => {
      count += 1;
      if (count > 40) {
        this.release(); // hard cap ~12s
        return;
      }
      fn();
    }, 300);
  }

  /** Stop a running long-press repeat. */
  release(): void {
    if (this._repeat != null) clearInterval(this._repeat);
    this._repeat = null;
  }

  // --- controls panel (value mapping) --------------------------------

  /** A control slider's controller by entity (light/number), or undefined. */
  ctlSlider(entity: string): SliderController | undefined {
    return this._ctlSliders.get(entity);
  }

  /**
   * Display value for a control slider with the snap-back hold applied (same
   * treatment as the volume/number sliders); retunes the hold's tolerance in place.
   */
  ctlValue(entity: string, s: SliderController): number {
    const { min, max, step } = ctlBounds(this.hass, entity);
    // eslint-disable-next-line no-param-reassign -- retune the per-entity hold's tolerance in place
    s.hold.tolerance = Math.max(step / 2, (max - min) / 1000);
    return s.value(
      ctlRawValue(this.hass, entity),
      isUnavail(this.hass && this.hass.states[entity]),
    );
  }

  /** True when a control select's chip drawer is open. */
  ctlOpen(entity: string): boolean {
    return !!this._ctlOpen.get(entity);
  }

  /** Flip a control select's chip drawer open/closed and re-render. */
  ctlToggle(entity: string): void {
    this._ctlOpen.set(entity, !this._ctlOpen.get(entity));
    this.requestUpdate();
  }

  // The raw write for a control slider: light → brightness (turn_off at 0),
  // number → set_value. The slider control arms/clears the hold around it.
  private _ctlSvc(entity: string, v: number): Promise<unknown> {
    if (!this.hass) return Promise.resolve();
    const dom = entity.split(".")[0];
    return dom === "light"
      ? setLightBrightness(this.hass, entity, v)
      : Promise.resolve(
          this.hass.callService(dom, "set_value", {
            entity_id: entity,
            value: v,
          }),
        );
  }

  /**
   * Fire-and-forget service for the non-slider controls (select/toggle/button);
   * swallow the rejection so it isn't unhandled.
   */
  ctlDo(domain: string, service: string, data?: Record<string, unknown>): void {
    if (!this.hass) return;
    Promise.resolve(this.hass.callService(domain, service, data)).catch(
      () => {},
    );
  }

  /** The displayed volume % (drag/hold applied) — also the relative-drag base. */
  volPct(): number {
    const mp = this.mp();
    const gone = !mp || GONE_STATES.includes(mp.state);
    const raw =
      mp && mp.attributes.volume_level != null
        ? Math.round(Number(mp.attributes.volume_level) * 100)
        : 0;
    return this._vol ? this._vol.value(raw, gone) : raw;
  }

  // D-pad swipe surface (swipe/both modes): tap → ok, flick → the dominant
  // direction. Pre-bound bundle so the dpad view can wire stable listeners.
  readonly swipe = {
    start: (e: PointerEvent): void => {
      capturePointer(e.currentTarget as Element, e.pointerId);
      this._sw = { x: e.clientX, y: e.clientY };
    },
    end: (e: PointerEvent): void => {
      const s = this._sw;
      this._sw = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.hypot(dx, dy) < 24) {
        this.send("ok"); // tap
        return;
      }
      let dir: string;
      if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? "right" : "left";
      else dir = dy > 0 ? "down" : "up";
      this.send(dir);
    },
    cancel: (): void => {
      this._sw = null;
    },
  };

  // Volume scrub strip (a device with no `volume_level`): one step per ~STEP_PX of
  // horizontal drag past the slop, throttled 120ms; the throttle is shared with the
  // end-button keyboard path. `step` recomputes the route each call — both directions
  // gate on the presence of the `volume_up` command (remote), else media_player step.
  // Pre-bound bundle so the volume view wires stable listeners.
  readonly scrub = {
    step: (dir: number): void => {
      if (this.unavail()) return;
      const key = dir > 0 ? "volume_up" : "volume_down";
      if (this.cmd("volume_up")) this.send(key);
      else this.mpDo(key);
    },
    stepThrottled: (dir: number): void => {
      if (this._scrubLock) return;
      this.scrub.step(dir);
      this._scrubLock = true;
      clearTimeout(this._scrubLockT);
      this._scrubLockT = setTimeout(() => {
        this._scrubLock = false;
      }, 120);
    },
    down: (e: PointerEvent): void => {
      if (this.unavail()) return;
      capturePointer(e.currentTarget as Element, e.pointerId);
      this._scrub = { lastX: e.clientX, moved: false };
      this.requestUpdate(); // reflect the .dragging grip state
    },
    move: (e: PointerEvent): void => {
      const s = this._scrub;
      if (!s) return;
      const SLOP = 4;
      const STEP_PX = 22;
      if (!s.moved && Math.abs(e.clientX - s.lastX) < SLOP) return;
      s.moved = true;
      if (Math.abs(e.clientX - s.lastX) >= STEP_PX && !this._scrubLock) {
        this.scrub.step(e.clientX > s.lastX ? 1 : -1);
        s.lastX = e.clientX;
        this._scrubLock = true;
        clearTimeout(this._scrubLockT);
        this._scrubLockT = setTimeout(() => {
          this._scrubLock = false;
        }, 120);
      }
    },
    up: (): void => {
      this._scrub = null;
      this.requestUpdate(); // clear the .dragging grip state
    },
    active: (): boolean => !!this._scrub,
  };

  /** Draw the card: optional switcher, header, d-pad, transport, volume, channel and sources. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const hl = this.hass;
    const multi = this._devices.length > 1;
    const sources = renderSources(this, hl);
    const controls = renderControls(this, hl);
    const two = !!(sources || controls);

    return html`<div
      class=${cx("card", card(), this.unavail() && "opacity-50")}
    >
      <div class="layout ${two ? "two" : ""}">
        <div
          class="body"
          role=${multi ? "tabpanel" : nothing}
          id=${multi ? "fibpanel" : nothing}
          aria-labelledby=${multi ? `fibtab-${this._sel}` : nothing}
        >
          ${renderSwitcher(this, hl)} ${renderHeader(this, hl)}
          ${renderDpad(this, hl)} ${renderNav(this, hl)}
          ${renderTransport(this)} ${renderVolRow(this, hl)}
          ${renderChannelRow(this)}
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
