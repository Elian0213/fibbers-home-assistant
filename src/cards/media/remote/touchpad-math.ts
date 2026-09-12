/* ================================================================== *
 * fibbers-remote — the touchpad step engine as pure math: velocity smoothing,
 * velocity-scaled step size, axis locking, the drain/drop accumulator, tap/edge
 * detection, momentum schedule, and the playback-scrub mapping. No DOM, no Lit,
 * no element state — the controller (touchpad-controller.ts) owns the mutable
 * gesture state and calls these; the maths is unit-tested directly.
 *
 * The engine emits a well-paced stream of logical directional steps: tvOS focus
 * animates at ~200ms, so emitting faster than MIN_INTERVAL only queues commands
 * and overshoots after the finger stops. Faster drag → smaller step → more
 * elements per centimetre (the acceleration curve the real Siri remote has).
 * ================================================================== */
import { clamp } from "@shared/util";

/** The locked drag axis, or null before the first decisive movement. */
export type Axis = "x" | "y" | null;

/** Per-device touchpad options (all optional; `resolveTouchpadOptions` fills defaults). */
export interface TouchpadOptions {
  edge_click?: boolean;
  momentum?: boolean;
  haptics?: boolean;
  sensitivity?: number;
  scrub?: boolean;
  native_touch?: boolean;
}

// step = width/6 at rest → a ~10cm slow drag on a ~230px surface ≈ 5-6 steps;
// width/16 is the fastest-drag floor (more elements per cm on a quick flick).
export const STEP_BASE_DIV = 6;
export const STEP_MIN_DIV = 16;
// tvOS focus animation floor; emitting faster just queues + overshoots.
export const MIN_INTERVAL = 60;
export const AXIS_LOCK_PX = 12;
export const AXIS_BREAK = 2.5;
export const TAP_PX = 10;
export const HOLD_MS = 500;
export const VMAX = 2; // px/ms velocity ceiling for step scaling
export const V_EPS = 0.05; // EMA below this = finger parked → stop draining
export const FLICK_V = 0.6; // px/ms release velocity to enter momentum
export const FLICK_STALE_MS = 80;
export const IN_FLIGHT_MAX = 2;
export const ACC_CLAMP_STEPS = 3;
export const EDGE_BAND = 0.22;
export const EDGE_HOLD_MS = 500;
export const MOMENTUM_GROWTH = 1.25;
export const MOMENTUM_STOP_MS = 260;
export const MOMENTUM_MAX = 12;
export const SCRUB_BASE_S = 90; // full surface width ≈ 90s at unit velocity
// Max multiplier 1 + 1.5 = 2.5× — the earlier 4× overshot by minutes on a fast sweep.
export const SCRUB_VEL_MAX = 1.5;
export const SCRUB_SEEK_MS = 400;
// Native-touch (Fibbers Bridge) streams a real 1:1 touch to the Apple TV; throttle
// the `hold` frames to the tvOS animation floor so the socket isn't flooded.
export const NATIVE_MIN_INTERVAL = 120;

/** Result of one drain attempt on the step accumulator. */
export interface StepResult {
  dir: -1 | 0 | 1; // 0 = nothing emitted (rate-limited or dropped)
  acc: number; // the accumulator after this attempt
  consumed: boolean; // a step was removed from the accumulator (emitted or dropped)
}

/** Exponential-moving-average velocity (px/ms); dt ≤ 0 leaves it unchanged. */
export function emaVelocity(v: number, d: number, dt: number): number {
  if (dt <= 0) return v;
  return 0.7 * v + 0.3 * (d / dt);
}

/**
 * Step size in px for the current drag speed: faster drag → smaller step → more
 * elements per centimetre. Clamped to [width/16, width/6]; `sensitivity` (>1 =
 * more steps) shrinks it.
 */
export function stepSize(
  vAbs: number,
  width: number,
  sensitivity: number,
): number {
  const base = width / STEP_BASE_DIV;
  const scaled =
    (base * (1 - 0.6 * (Math.min(vAbs, VMAX) / VMAX))) / sensitivity;
  return clamp(scaled, width / STEP_MIN_DIV, base);
}

/**
 * Decide the drag axis from the total travel since pointerdown. Locks to the
 * dominant axis once travel passes AXIS_LOCK_PX; once locked, only flips when the
 * other axis' travel exceeds AXIS_BREAK× the locked one.
 */
export function lockAxis(ax: number, ay: number, axis: Axis): Axis {
  if (axis === null) {
    if (Math.hypot(ax, ay) < AXIS_LOCK_PX) return null;
    return ax >= ay ? "x" : "y";
  }
  if (axis === "x") return ay > AXIS_BREAK * ax ? "y" : "x";
  return ax > AXIS_BREAK * ay ? "x" : "y";
}

/**
 * Try to drain one step from the accumulator. Emits when it holds a full step and
 * MIN_INTERVAL has passed since the last send; if too many calls are in flight the
 * step is consumed-and-dropped (dir 0) rather than queued, so nothing arrives after
 * the finger stops. The accumulator is always clamped to ACC_CLAMP_STEPS worth so a
 * frantic drag can't build a backlog.
 */
export function tryStep(
  acc: number,
  step: number,
  now: number,
  sentAt: number,
  inFlight: number,
): StepResult {
  const cap = ACC_CLAMP_STEPS * step;
  let a = acc;
  if (a > cap) a = cap;
  else if (a < -cap) a = -cap;
  if (Math.abs(a) >= step && now - sentAt >= MIN_INTERVAL) {
    const dir = a > 0 ? 1 : -1;
    a -= dir * step;
    if (inFlight >= IN_FLIGHT_MAX) return { dir: 0, acc: a, consumed: true };
    return { dir, acc: a, consumed: true };
  }
  return { dir: 0, acc: a, consumed: false };
}

/** A gesture is a tap when it barely moved and no long-press fired. */
export function isTap(distPx: number, holdFired: boolean): boolean {
  return distPx < TAP_PX && !holdFired;
}

/**
 * The edge zone a point falls in (outer `band` of the surface), or null for the
 * centre. A corner resolves to whichever edge it has penetrated more deeply.
 */
export function edgeZone(
  x: number,
  y: number,
  w: number,
  h: number,
  band: number = EDGE_BAND,
): "up" | "down" | "left" | "right" | null {
  const bx = w * band;
  const by = h * band;
  const left = x;
  const right = w - x;
  const top = y;
  const bottom = h - y;
  const cands: ["up" | "down" | "left" | "right", number][] = [];
  if (left < bx) cands.push(["left", left]);
  if (right < bx) cands.push(["right", right]);
  if (top < by) cands.push(["up", top]);
  if (bottom < by) cands.push(["down", bottom]);
  if (!cands.length) return null;
  cands.sort((a, b) => a[1] - b[1]);
  return cands[0][0];
}

/** A momentum step schedule after a flick: a direction and decaying inter-step delays. */
interface Momentum {
  dir: -1 | 1;
  delays: number[];
}

/**
 * The momentum schedule for a release velocity: step count scales with speed
 * (2 for a soft flick, up to MOMENTUM_MAX for a hard one) and the delays grow
 * geometrically until they exceed MOMENTUM_STOP_MS.
 */
export function momentumSchedule(vAbs: number, dir: -1 | 1): Momentum {
  const count = clamp(Math.round((vAbs - FLICK_V) * 8) + 2, 2, MOMENTUM_MAX);
  const delays: number[] = [];
  let interval = MIN_INTERVAL;
  for (let i = 0; i < count; i += 1) {
    if (interval > MOMENTUM_STOP_MS) break;
    delays.push(Math.round(interval));
    interval *= MOMENTUM_GROWTH;
  }
  return { dir, delays };
}

/**
 * Seconds to seek for a frame's horizontal travel: a fixed ~90s-per-surface-width
 * base (platform-independent muscle memory) times a velocity multiplier so a fast
 * sweep still covers minutes, times `sensitivity`.
 */
export function scrubStep(
  dxFrame: number,
  width: number,
  vAbs: number,
  sensitivity: number,
): number {
  const rate = SCRUB_BASE_S / width;
  return dxFrame * rate * (1 + Math.min(vAbs, SCRUB_VEL_MAX)) * sensitivity;
}

/**
 * Map a pointer position along one axis of the touch surface to pyatv's 0–1000
 * touch-coordinate space (rounded, clamped) — so a native-touch drag mirrors the
 * finger 1:1 onto the Apple TV's own surface.
 */
export function normCoord(client: number, start: number, size: number): number {
  if (!(size > 0)) return 500;
  return clamp(Math.round(((client - start) / size) * 1000), 0, 1000);
}

/** A live playback position + duration, or null when the media isn't seekable. */
export interface Position {
  pos: number;
  dur: number;
}

/**
 * The live position of playing media: `media_position` plus the wall-clock elapsed
 * since `media_position_updated_at` while playing (HA only samples on state change),
 * clamped to the duration. Returns null when position/duration are unusable.
 */
export function livePosition(
  pos: number,
  updatedAt: number,
  playing: boolean,
  now: number,
  dur: number,
): Position | null {
  if (!Number.isFinite(pos) || !Number.isFinite(dur) || dur <= 0) return null;
  let p = pos;
  if (playing && Number.isFinite(updatedAt)) p = pos + (now - updatedAt) / 1000;
  return { pos: clamp(p, 0, dur), dur };
}

/** Format seconds as `m:ss`, or `h:mm:ss` past an hour, for the scrub overlay. */
export function fmtTime(s: number): string {
  const sec = Math.max(0, Math.floor(s));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}

/**
 * Fill a raw `touchpad:` options object with defaults; `sensitivity` clamps to
 * [0.25, 4]. Config validation (config.ts) already rejects out-of-range sensitivity,
 * so this clamp is defensive for any direct caller (tests, a future JSON load).
 */
export function resolveTouchpadOptions(
  raw: TouchpadOptions | undefined,
): Required<TouchpadOptions> {
  const o = raw || {};
  const s = Number(o.sensitivity);
  return {
    edge_click: o.edge_click !== false,
    momentum: o.momentum !== false,
    haptics: o.haptics !== false,
    sensitivity: Number.isFinite(s) && s >= 0.25 && s <= 4 ? s : 1,
    scrub: o.scrub !== false,
    native_touch: o.native_touch !== false,
  };
}
