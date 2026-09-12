/* ================================================================== *
 * fibbers-remote — the touchpad gesture controller: a Lit ReactiveController that
 * turns raw pointer events on the touchpad surface into a well-paced stream of
 * logical remote keys (via the step engine in touchpad-math), a long-press context
 * menu, held-direction repeat, flick momentum, and — during playback — a pause +
 * timeline-scrub gesture. All in-gesture feedback (finger dot, edge flashes, scrub
 * overlay) is written straight to cached DOM refs inside one rAF loop, so a drag
 * never triggers a Lit re-render (acceptance: zero updated() calls mid-drag).
 *
 * Touch correctness (hard-won in v1.0.2/1.0.3, see body-layer.ts): the surface has
 * `touch-action: none`; explicit pointer capture is taken ONLY for mouse (touch
 * relies on implicit capture — grabbing it fires a bubbling lostpointercapture that
 * kills the gesture); `lostpointercapture` is filtered by target; one pointerId owns
 * the gesture (a second finger is ignored, which doubles as palm rejection).
 * ================================================================== */
import type { ReactiveController, ReactiveControllerHost } from "lit";

import { capturePointer, clamp } from "@shared/util";

import {
  emaVelocity,
  stepSize,
  lockAxis,
  tryStep,
  isTap,
  edgeZone,
  momentumSchedule,
  scrubStep,
  normCoord,
  fmtTime,
  HOLD_MS,
  TAP_PX,
  V_EPS,
  FLICK_V,
  FLICK_STALE_MS,
  IN_FLIGHT_MAX,
  SCRUB_SEEK_MS,
  NATIVE_MIN_INTERVAL,
  type Axis,
  type TouchpadOptions,
} from "./touchpad-math";

/**
 * Live playback state the scrub gesture needs. Present whenever the device has a
 * media_player; `pos`/`dur` are meaningful only when `seekable` (drift-corrected
 * by the host) — Netflix-class apps report a state but no timeline.
 */
export interface PlaybackInfo {
  state: string;
  seekable: boolean;
  pos: number;
  dur: number;
}

/**
 * The scrub transport chosen when a horizontal drag begins during playback:
 * - `native` — stream a real 1:1 touch to the Apple TV's own surface via the
 *   Fibbers Bridge backend (`fibbers_bridge/atv_touch`). Works in every app incl.
 *   Netflix; the TV's own scrubber follows the finger. Chosen when the bridge is
 *   installed + reachable.
 * - `seek` — absolute `media_seek` (the app reports a timeline; no bridge).
 * - `inert` — the app reports no timeline and there's no bridge (Netflix-class):
 *   consume the horizontal drag so it does NOT fall through to nav left/right
 *   (= 10s skips), but take no media action.
 */
type ScrubTransport = "native" | "seek" | "inert";

/** The element surface the touchpad controller drives — an adapter over FibbersRemote. */
export interface TouchpadHost extends ReactiveControllerHost {
  /** Emit a logical key over the remote/media_player path. */
  send(key: string): Promise<void> | void;
  /** Emit a logical key as a long-press (remote.send_command hold_secs: 1). */
  sendHold(key: string): void;
  /** Start the shared client-side long-press repeat around `fn`. */
  holdRepeat(fn: () => void): void;
  /** Stop the shared long-press repeat. */
  holdRelease(): void;
  /** Fire-and-forget media_player service (pause/seek/play). */
  mediaDo(service: string, data?: Record<string, unknown>): void;
  /** Live playback info whenever the device has a media_player, else null. */
  playback(): PlaybackInfo | null;
  /** True when the Fibbers Bridge native-touch backend is reachable for this device. */
  nativeTouchReady(): boolean;
  /** Fire-and-forget a native touch phase (0–1000 coords) at the Apple TV surface. */
  nativeTouch(mode: "press" | "hold" | "release", x: number, y: number): void;
  /** True when the current device is unavailable (gesture is a no-op). */
  unavail(): boolean;
  /** The resolved touchpad options for the current device. */
  opts(): Required<TouchpadOptions>;
  /** Whether to log emit→ack latency. */
  debug(): boolean;
}

type Phase =
  "idle" | "pending" | "nav" | "scrub" | "edgeHold" | "holdFired" | "momentum";

type Dir = "up" | "down" | "left" | "right";

const now = (): number => performance.now();

/** The logical key for a step on the locked axis (screen coords: +y is down). */
function dirKey(axis: Axis, dir: number): Dir {
  if (axis === "x") return dir > 0 ? "right" : "left";
  return dir > 0 ? "down" : "up";
}

/**
 * The touchpad gesture state machine. One instance per card, constructed once in
 * setConfig; `attach` is wired to the surface via lit's `ref`, and the pointer
 * handlers (down/move/up/cancel/lost) are wired in the touchpad view template.
 */
export class TouchpadController implements ReactiveController {
  private host: TouchpadHost;

  // cached DOM refs (set in attach, mutated by the rAF painter)
  private surface?: HTMLElement;

  private dot?: HTMLElement;

  private edges?: Record<Dir, HTMLElement>;

  private scrubBox?: HTMLElement;

  private timeEl?: HTMLElement;

  private fillEl?: HTMLElement;

  private durEl?: HTMLElement;

  private reducedMotion = false;

  // gesture state (none of it is reactive — nothing here triggers a render)
  private phase: Phase = "idle";

  private pid = -1;

  private rect: DOMRect | null = null;

  private downX = 0;

  private downY = 0;

  private lastX = 0;

  private lastY = 0;

  private lastT = 0;

  private acc = 0; // locked-axis step accumulator (px)

  private axis: Axis = null;

  private vX = 0; // EMA velocity px/ms

  private vY = 0;

  private sentAt = -Infinity;

  private inFlight = 0;

  private caughtMomentum = false;

  private holdTimer?: ReturnType<typeof setTimeout>;

  private momentumTimer?: ReturnType<typeof setTimeout>;

  private rafId = 0;

  private pendingMove: PointerEvent | null = null;

  // scrub state
  private scrubTransport: ScrubTransport = "seek"; // transport of the LIVE scrub

  private scrubPos = 0;

  private scrubDur = 0;

  private lastSeekAt = -Infinity;

  private lastSeekSent = NaN;

  private resumeHint = false;

  private resumeHintT?: ReturnType<typeof setTimeout>;

  // native-touch (Fibbers Bridge) scrub state — a real 1:1 touch streamed to the ATV
  private nativePressed = false; // a `press` is live and MUST be released

  private nativeAt = -Infinity; // last `hold` frame timestamp (throttle)

  private nativeX = 500; // last coords sent (reused for the release phase)

  private nativeY = 500;

  private scrubHideT?: ReturnType<typeof setTimeout>;

  private lat: number[] = [];

  constructor(host: TouchpadHost) {
    this.host = host;
    host.addController(this);
  }

  /** ReactiveController teardown — kill every timer/loop and any live gesture. */
  hostDisconnected(): void {
    this.abort();
  }

  /** On every hass push, disengage a scrub whose media went away, and drop a stale resume hint. */
  hostUpdated(): void {
    const pb = this.host.playback();
    const gone = !pb || (pb.state !== "paused" && pb.state !== "playing");
    if (this.phase === "scrub" && gone) {
      // content changed / player gone → abandon the scrub, ignore frames until release
      this._releaseNative(); // never strand a live native press on a mid-drag disengage
      this._hideScrub();
      this.phase = "idle";
    }
    if (this.resumeHint && (gone || (pb && pb.state === "playing"))) {
      this._clearResumeHint();
      // A content swap within the hint window must not inherit the old content's
      // seek position on the next paused re-entry.
      if (gone) this.lastSeekSent = NaN;
    }
  }

  /** lit `ref` callback: cache the surface + feedback nodes (or clear them on unbind). */
  readonly attach = (el?: Element): void => {
    if (!el) {
      this.surface = undefined;
      return;
    }
    const root = el as HTMLElement;
    this.surface = root;
    this.dot = root.querySelector(".tp-dot") as HTMLElement;
    this.edges = {
      up: root.querySelector(".tp-edge.up") as HTMLElement,
      down: root.querySelector(".tp-edge.down") as HTMLElement,
      left: root.querySelector(".tp-edge.left") as HTMLElement,
      right: root.querySelector(".tp-edge.right") as HTMLElement,
    };
    this.scrubBox = root.querySelector(".tp-scrub") as HTMLElement;
    this.timeEl = root.querySelector(".tp-time") as HTMLElement;
    this.fillEl = root.querySelector(".tp-fill") as HTMLElement;
    this.durEl = root.querySelector(".tp-dur") as HTMLElement;
    this.reducedMotion =
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  /** Pointer-down: claim the gesture, cancel momentum, arm the long-press timer. */
  readonly down = (e: PointerEvent): void => {
    if (this.pid !== -1) return; // one pointer owns the gesture (palm rejection)
    if (this.host.unavail()) return;
    // Catching live momentum stops it dead and must not also count as a tap.
    this.caughtMomentum = this.phase === "momentum";
    this._stopMomentum();
    this.pid = e.pointerId;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    // Capture explicitly ONLY for mouse; touch/pen rely on implicit capture.
    if (e.pointerType === "mouse" && this.surface)
      capturePointer(this.surface, e.pointerId);
    this.rect = this.surface?.getBoundingClientRect() ?? null;
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.lastT = e.timeStamp;
    this.acc = 0;
    this.axis = null;
    this.vX = 0;
    this.vY = 0;
    this.sentAt = -Infinity;
    this.phase = "pending";
    this._paintDot(this._relX(e.clientX), this._relY(e.clientY));
    this.holdTimer = setTimeout(() => this._onHold(), HOLD_MS);
  };

  /** Pointer-move: stash the event; the engine runs once per animation frame. */
  readonly move = (e: PointerEvent): void => {
    if (e.pointerId !== this.pid) return;
    e.stopPropagation();
    this.pendingMove = e;
    if (!this.rafId) this.rafId = requestAnimationFrame(this.frame);
  };

  /** Pointer-up: resolve tap / edge-click / flick-momentum / scrub commit. */
  readonly up = (e: PointerEvent): void => {
    if (e.pointerId !== this.pid) return;
    e.stopPropagation();
    this._endGesture(e, false);
  };

  /** Pointer-cancel: clean end with zero velocity (no tap, no momentum). */
  readonly cancel = (e: PointerEvent): void => {
    if (e.pointerId !== this.pid) return;
    this._endGesture(e, true);
  };

  /** Lost capture: only our surface's own loss ends the gesture (child losses bubble). */
  readonly lost = (e: PointerEvent): void => {
    if (e.target !== this.surface || e.pointerId !== this.pid) return;
    this._endGesture(e, true);
  };

  /** Kill every timer, the rAF loop, momentum, edge-repeat and any live scrub. */
  abort(): void {
    clearTimeout(this.holdTimer);
    this.holdTimer = undefined;
    clearTimeout(this.scrubHideT);
    this.scrubHideT = undefined;
    clearTimeout(this.resumeHintT);
    this.resumeHintT = undefined;
    this._stopMomentum();
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.pendingMove = null;
    this.host.holdRelease();
    this._releaseNative(); // a dangling native press must never survive a teardown
    this._hideDot();
    this._hideScrub();
    this.resumeHint = false;
    // Continuity state must not survive a device switch or a hidden tab.
    this.lastSeekSent = NaN;
    this.pid = -1;
    this.phase = "idle";
  }

  // --- internals -----------------------------------------------------

  private _relX(clientX: number): number {
    return clientX - (this.rect?.left ?? 0);
  }

  private _relY(clientY: number): number {
    return clientY - (this.rect?.top ?? 0);
  }

  private _edgeAt(clientX: number, clientY: number): Dir | null {
    if (!this.rect) return null;
    return edgeZone(
      this._relX(clientX),
      this._relY(clientY),
      this.rect.width,
      this.rect.height,
    );
  }

  // The long-press timer fired without the finger moving past the tap slop: a
  // centre press opens the tvOS context menu; an edge press repeats that direction.
  private _onHold(): void {
    if (this.phase !== "pending") return;
    const o = this.host.opts();
    const zone = o.edge_click ? this._edgeAt(this.downX, this.downY) : null;
    if (zone) {
      this.phase = "edgeHold";
      this.host.holdRepeat(() => this.host.send(zone));
      this._vibrate(8);
    } else {
      this.phase = "holdFired";
      this.host.sendHold("ok");
      this._vibrate(12);
    }
  }

  private readonly frame = (): void => {
    this.rafId = 0;
    const e = this.pendingMove;
    this.pendingMove = null;
    if (!e || e.pointerId !== this.pid) return;
    const t = e.timeStamp;
    const dt = t - this.lastT;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.vX = emaVelocity(this.vX, dx, dt);
    this.vY = emaVelocity(this.vY, dy, dt);
    const adx = Math.abs(e.clientX - this.downX);
    const ady = Math.abs(e.clientY - this.downY);
    this._paintDot(this._relX(e.clientX), this._relY(e.clientY));
    // Read the resolved options once per frame — `opts()` allocates a fresh object,
    // and nothing about it changes mid-frame.
    const opts = this.host.opts();

    if (this.phase === "pending") {
      if (
        this.holdTimer &&
        Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > TAP_PX
      ) {
        clearTimeout(this.holdTimer);
        this.holdTimer = undefined;
      }
      const axis = lockAxis(adx, ady, null);
      if (axis) {
        this.axis = axis;
        const pb = axis === "x" && opts.scrub ? this.host.playback() : null;
        const transport = pb ? this._scrubTransportFor(pb) : null;
        if (pb && transport) {
          // A horizontal drag during playback scrubs (native/seek) or is consumed
          // (inert for timeline-less apps) — it must NEVER fall to nav left/right,
          // which is what turns a Netflix slide into 10s skips.
          this._startScrub(pb, transport, e);
        } else {
          this.phase = "nav";
          // Seed the accumulator with the travel since down so the first step
          // lands promptly (acceptance: first focus step < 120ms).
          this.acc =
            axis === "x" ? e.clientX - this.downX : e.clientY - this.downY;
          this._driveNav(t, opts.sensitivity);
        }
      }
    } else if (this.phase === "nav") {
      const na = lockAxis(adx, ady, this.axis);
      if (na !== this.axis) {
        this.axis = na;
        this.acc = na === "x" ? e.clientX - this.downX : e.clientY - this.downY;
      } else {
        this.acc += this.axis === "x" ? dx : dy;
      }
      this._driveNav(t, opts.sensitivity);
    } else if (this.phase === "scrub") {
      this._driveScrub(e, dx, t, opts.sensitivity);
    }

    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.lastT = t;
  };

  private _driveNav(t: number, sensitivity: number): void {
    const vAbs = Math.abs(this.axis === "x" ? this.vX : this.vY);
    // A parked finger decays the EMA within a few frames; drop the residual so no
    // step lands after the finger stops (acceptance: zero overshoot).
    if (vAbs <= V_EPS) {
      this.acc = 0;
      return;
    }
    const width = this.rect?.width ?? 230;
    const step = stepSize(vAbs, width, sensitivity);
    const r = tryStep(this.acc, step, t, this.sentAt, this.inFlight);
    this.acc = r.acc;
    if (r.dir !== 0) {
      this._emit(r.dir);
      this.sentAt = t;
    }
  }

  private _emit(dir: 1 | -1): void {
    const key = dirKey(this.axis, dir);
    this.inFlight += 1;
    const t0 = this.host.debug() ? now() : 0;
    Promise.resolve(this.host.send(key)).finally(() => {
      this.inFlight -= 1;
      if (this.host.debug()) this._recordLatency(now() - t0);
    });
    this._flashEdge(key);
    this._vibrate(8);
  }

  // The scrub transport for a horizontal drag in the current playback context, or
  // null → treat as nav. When the Fibbers Bridge backend is reachable → native (a
  // real 1:1 touch streamed to the ATV: works in every app incl. Netflix). Else,
  // playing → seek (real timeline) or inert (no timeline; consume, don't skip);
  // paused → seek only to resume OUR own paused session (resumeHint), else inert
  // (don't yank a browsing player, don't skip). Idle / menu / off → null so
  // horizontal drags navigate menus (left/right) as normal.
  private _scrubTransportFor(pb: PlaybackInfo): ScrubTransport | null {
    if (pb.state !== "playing" && pb.state !== "paused") return null;
    if (this.host.nativeTouchReady()) return "native";
    if (pb.state === "playing") return pb.seekable ? "seek" : "inert";
    if (!pb.seekable) return "inert";
    return this.resumeHint ? "seek" : "inert";
  }

  private _startScrub(
    pb: PlaybackInfo,
    transport: ScrubTransport,
    e: PointerEvent,
  ): void {
    this.phase = "scrub";
    this.scrubTransport = transport;
    if (this.host.debug())
      // eslint-disable-next-line no-console -- behind the `debug:` flag only
      console.debug(
        `[fibbers-remote] scrub entry: state=${pb.state} seekable=${pb.seekable} transport=${transport}`,
      );
    // native: press a real 1:1 touch at the finger point on the ATV surface, then
    // stream `hold` frames as the finger moves (see _driveScrub). No pause/seek and
    // no overlay — the TV's own scrubber is the feedback; the finger dot still follows.
    if (transport === "native") {
      const { x, y } = this._nativeXY(e.clientX, e.clientY);
      this.nativeX = x;
      this.nativeY = y;
      this.nativeAt = -Infinity;
      this.nativePressed = true;
      this.host.nativeTouch("press", x, y);
      return;
    }
    // inert: consume the horizontal drag (the finger dot still follows) but take
    // no media action — a real scrub needs the native-touch backend.
    if (transport === "inert") return;
    const fresh = pb.state === "playing";
    if (fresh) this.host.mediaDo("media_pause"); // a paused entry never re-pauses
    // Re-entry continuity: HA's position is stale right after our own seeks —
    // resume from the last position we sent, not pb.pos, when re-entering paused.
    this.scrubPos =
      !fresh && Number.isFinite(this.lastSeekSent) ? this.lastSeekSent : pb.pos;
    this.scrubDur = pb.dur;
    this.lastSeekAt = -Infinity;
    if (fresh) this.lastSeekSent = NaN; // fresh session — no stale continuity
    clearTimeout(this.scrubHideT);
    this._showScrub();
    this._paintScrub();
  }

  private _driveScrub(
    e: PointerEvent,
    dx: number,
    t: number,
    sensitivity: number,
  ): void {
    if (this.scrubTransport === "native") {
      // Stream the finger's absolute position as `hold` frames, throttled to the
      // tvOS animation floor so the socket isn't flooded. The TV scrubs 1:1.
      const { x, y } = this._nativeXY(e.clientX, e.clientY);
      this.nativeX = x;
      this.nativeY = y;
      if (t - this.nativeAt >= NATIVE_MIN_INTERVAL) {
        this.host.nativeTouch("hold", x, y);
        this.nativeAt = t;
      }
      return;
    }
    if (this.scrubTransport === "inert") return; // consume, no media action
    const width = this.rect?.width ?? 230;
    const secs = scrubStep(dx, width, Math.abs(this.vX), sensitivity);
    this.scrubPos = clamp(this.scrubPos + secs, 0, this.scrubDur);
    this._paintScrub();
    if (
      t - this.lastSeekAt >= SCRUB_SEEK_MS &&
      Math.abs(this.scrubPos - this.lastSeekSent) >= 1
    ) {
      this.host.mediaDo("media_seek", {
        seek_position: Math.round(this.scrubPos),
      });
      this.lastSeekAt = t;
      this.lastSeekSent = this.scrubPos;
    }
  }

  private _endGesture(e: PointerEvent, cancelled: boolean): void {
    clearTimeout(this.holdTimer);
    this.holdTimer = undefined;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.pendingMove = null;
    this._hideDot();
    const { phase } = this;
    const dist = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
    const t = e.timeStamp;
    this.pid = -1;

    if (phase === "pending") {
      if (!cancelled && isTap(dist, false)) this._resolveTap();
      this.phase = "idle";
    } else if (phase === "nav") {
      this.phase = "idle";
      if (!cancelled) {
        const vAbs = Math.abs(this.axis === "x" ? this.vX : this.vY);
        const fresh = t - this.lastT <= FLICK_STALE_MS;
        if (this.host.opts().momentum && vAbs > FLICK_V && fresh)
          this._startMomentum(vAbs);
      }
    } else if (phase === "scrub") {
      this._finishScrub();
    } else if (phase === "edgeHold") {
      this.host.holdRelease();
      this.phase = "idle";
    } else {
      this.phase = "idle"; // holdFired / momentum-caught
    }
    this.caughtMomentum = false;
  }

  private _resolveTap(): void {
    if (this.caughtMomentum) return; // the down that stopped momentum is not a tap
    const o = this.host.opts();
    const zone = o.edge_click ? this._edgeAt(this.downX, this.downY) : null;
    if (zone) {
      this.host.send(zone);
    } else if (this.resumeHint) {
      // We paused for a seek-scrub; resume via the transport layer (deterministic).
      this.host.mediaDo("media_play");
      this._clearResumeHint();
    } else {
      this.host.send("ok");
    }
  }

  private _startMomentum(vAbs: number): void {
    const dir: 1 | -1 = (this.axis === "x" ? this.vX : this.vY) > 0 ? 1 : -1;
    const { delays } = momentumSchedule(vAbs, dir);
    if (!delays.length) {
      this.phase = "idle";
      return;
    }
    this.phase = "momentum";
    let i = 0;
    const tick = (): void => {
      if (this.phase !== "momentum" || i >= delays.length) {
        this.phase = "idle";
        this.momentumTimer = undefined;
        return;
      }
      if (this.inFlight < IN_FLIGHT_MAX) this._emit(dir); // saturated → drop, not defer
      const d = delays[i];
      i += 1;
      this.momentumTimer = setTimeout(tick, d);
    };
    tick();
  }

  private _stopMomentum(): void {
    clearTimeout(this.momentumTimer);
    this.momentumTimer = undefined;
    if (this.phase === "momentum") this.phase = "idle";
  }

  private _finishScrub(): void {
    this.phase = "idle";
    if (this.scrubTransport === "native") {
      // Lift the finger off the ATV surface. tvOS commits the scrubber where the
      // touch ended; a later tap = select (resume) via the normal tap path.
      this._releaseNative();
      return;
    }
    if (this.scrubTransport !== "seek") return; // inert: nothing landed, nothing to resume
    // Commit the last previewed position (on normal release AND cancel — the user
    // watched the preview move; leaving it uncommitted is worse). Stays paused;
    // a tap resumes.
    if (
      Number.isNaN(this.lastSeekSent) ||
      Math.abs(this.scrubPos - this.lastSeekSent) >= 0.5
    ) {
      this.host.mediaDo("media_seek", {
        seek_position: Math.round(this.scrubPos),
      });
      this.lastSeekSent = this.scrubPos;
    }
    this._setResumeHint();
    clearTimeout(this.scrubHideT);
    this.scrubHideT = setTimeout(() => this._hideScrub(), 800);
  }

  private _setResumeHint(): void {
    this.resumeHint = true;
    clearTimeout(this.resumeHintT);
    this.resumeHintT = setTimeout(() => {
      this.resumeHint = false;
    }, 30000);
  }

  private _clearResumeHint(): void {
    this.resumeHint = false;
    clearTimeout(this.resumeHintT);
    this.resumeHintT = undefined;
  }

  // Map a client point to the ATV's 0–1000 touch space using the cached surface rect.
  private _nativeXY(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } {
    const r = this.rect;
    return {
      x: normCoord(clientX, r?.left ?? 0, r?.width ?? 0),
      y: normCoord(clientY, r?.top ?? 0, r?.height ?? 0),
    };
  }

  // Release a live native press (idempotent). Called on gesture end, cancel, and abort.
  private _releaseNative(): void {
    if (!this.nativePressed) return;
    this.nativePressed = false;
    this.host.nativeTouch("release", this.nativeX, this.nativeY);
  }

  private _vibrate(ms: number): void {
    if (!this.host.opts().haptics) return;
    if (typeof navigator !== "undefined" && navigator.vibrate)
      navigator.vibrate(ms);
  }

  private _paintDot(x: number, y: number): void {
    if (this.reducedMotion || !this.dot) return;
    this.dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    this.dot.style.opacity = "1";
  }

  private _hideDot(): void {
    if (this.dot) this.dot.style.opacity = "0";
  }

  private _flashEdge(dir: Dir): void {
    const el = this.edges?.[dir];
    if (!el) return;
    el.style.opacity = "1";
    // Back to the stylesheet next frame so the CSS transition fades it out.
    requestAnimationFrame(() => {
      el.style.opacity = "";
    });
  }

  private _showScrub(): void {
    this.scrubBox?.classList.add("on");
  }

  private _hideScrub(): void {
    this.scrubBox?.classList.remove("on");
  }

  private _paintScrub(): void {
    if (this.timeEl) this.timeEl.textContent = fmtTime(this.scrubPos);
    if (this.durEl) this.durEl.textContent = fmtTime(this.scrubDur);
    if (this.fillEl)
      this.fillEl.style.width = `${this.scrubDur > 0 ? (this.scrubPos / this.scrubDur) * 100 : 0}%`;
  }

  private _recordLatency(ms: number): void {
    this.lat.push(ms);
    if (this.lat.length < 20) return;
    const sorted = [...this.lat].sort((a, b) => a - b);
    const q = (p: number): number =>
      sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    // eslint-disable-next-line no-console -- behind the `debug:` flag only
    console.debug(
      `[fibbers-remote] touchpad emit→ack p50=${Math.round(q(0.5))}ms p95=${Math.round(q(0.95))}ms (n=${this.lat.length})`,
    );
    this.lat = [];
  }
}
