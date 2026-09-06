/* ================================================================== *
 * UI — shared lit-html widget templates + keyboard/slider helpers.
 * One source for each control's look; import what you need. Templates are
 * presentational — the caller always owns the value mapping and service call.
 * ================================================================== */
import {
  html,
  nothing,
  type TemplateResult,
  type ReactiveController,
  type ReactiveControllerHost,
} from "lit";

import { t } from "@shared/i18n";
import { capturePointer, debounce } from "@shared/util";
import { pressable } from "@shared/variants";

/**
 * Enter/Space → activate, for elements carrying role="button" instead of a real
 * <button> (native buttons get this free). Pair with tabindex="0".
 * @param fn — invoked with the keyboard event
 * @returns keydown handler
 */
export function activateOnKey(
  fn: (e: KeyboardEvent) => void,
): (e: KeyboardEvent) => void {
  return (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn(e);
    }
  };
}

/** Options for a {@link SliderHold}. */
export interface SliderHoldOptions {
  tolerance?: number;
  timeout?: number;
}

/** Options for {@link SliderHold.value} — the current drag/display state. */
export interface SliderHoldValueOptions {
  dragging?: boolean;
  dragValue?: number;
  gone?: boolean;
}

/**
 * Fixes the "slider snaps back for one round trip" bug once, for every slider.
 * After a commit we HOLD the committed value on screen until the entity catches
 * up (within `tolerance`) or `timeout` elapses — so releasing at 70% on a lamp
 * still reporting 5% doesn't flash 70 → 5 → 70. A Lit ReactiveController so the
 * timeout can re-render, and it cleans up on disconnect.
 *
 *   this._hold = new SliderHold(this, { tolerance: 2 });     // in setConfig
 *   this._hold.hold(pct);                                    // in commit, before callService
 *   this._hold.value(hassPct, { dragging, dragValue, gone }) // when computing the display
 */
export class SliderHold implements ReactiveController {
  private host: ReactiveControllerHost;

  /** Landing tolerance — cards retune it per entity (e.g. step/2 for numbers). */
  tolerance: number;

  private timeout: number;

  private _pending: number | null;

  private _timer: ReturnType<typeof setTimeout> | null;

  /**
   * Attach the hold to `host` as a reactive controller.
   * @param host — the Lit host to attach the controller to.
   * @param opts — `{ tolerance, timeout }`.
   */
  constructor(
    host: ReactiveControllerHost,
    { tolerance = 2, timeout = 2000 }: SliderHoldOptions = {},
  ) {
    this.host = host;
    host.addController(this);
    this.tolerance = tolerance;
    this.timeout = timeout;
    this._pending = null;
    this._timer = null;
  }

  /** Hold `value` on screen and start the release timer. @param value */
  hold(value: number): void {
    this._pending = value;
    if (this._timer != null) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._pending = null;
      this._timer = null;
      this.host.requestUpdate();
    }, this.timeout);
  }

  /**
   * The value to display: drag value while dragging → held value until the entity
   * lands (or vanishes) → the entity value. Never compares for equality —
   * `tolerance` absorbs brightness_pct↔0-255 rounding and seek drift.
   * @param entityValue
   * @param opts — `{ dragging, dragValue, gone }`
   * @returns the value to render
   */
  value(
    entityValue: number,
    { dragging, dragValue, gone }: SliderHoldValueOptions = {},
  ): number {
    if (dragging) return dragValue as number;
    if (this._pending == null) return entityValue;
    const landed =
      entityValue != null &&
      Math.abs(entityValue - this._pending) <= this.tolerance;
    if (gone || landed) {
      // already rendering the entity value — clear silently, no requestUpdate
      this._pending = null;
      if (this._timer != null) clearTimeout(this._timer);
      this._timer = null;
      return entityValue;
    }
    return this._pending;
  }

  /**
   * Drop a pending hold without waiting for the entity to land — call from a failed
   * commit (`.catch`) so a service error doesn't freeze the display on the
   * optimistic value until the timeout.
   */
  clear(): void {
    if (this._pending == null && this._timer == null) return;
    this._pending = null;
    if (this._timer != null) clearTimeout(this._timer);
    this._timer = null;
    this.host.requestUpdate();
  }

  /** ReactiveController teardown — cancel the timer and deregister from the host. */
  hostDisconnected(): void {
    this._pending = null;
    if (this._timer != null) clearTimeout(this._timer);
    this._timer = null;
    // Lit does have removeController — deregister so the host doesn't retain the
    // controller after unmount. (Cards still reuse one hold across setConfig; that
    // guard prevents stacking a fresh controller per editor keystroke, which
    // hostDisconnected can't help with since it only fires on unmount.)
    if (this.host.removeController) this.host.removeController(this);
  }
}

/** Live gesture bookkeeping handed to {@link pointerDrag} callbacks. */
export interface PointerDragState {
  pointerId: number;
  startX: number;
  startY: number;
  /** True once the pointer has travelled past the slop distance. */
  moved: boolean;
}

/** Options (callbacks) for {@link pointerDrag}. */
export interface PointerDragOptions {
  /** Movement (px, euclidean) before `moved` flips — a stationary tap stays under it. Default 4. */
  slop?: number;
  /**
   * The element to capture the pointer on. MUST be an element whose identity
   * survives Lit re-renders mid-drag (a stable container, not a marker that gets
   * re-created) — losing the captured element kills the gesture. Default:
   * `e.currentTarget`.
   */
  captureEl?: (e: PointerEvent) => Element | null;
  /** Gesture gate — return false to reject this pointerdown (e.g. unavailable entity). */
  start?: (e: PointerEvent, s: PointerDragState) => boolean | void;
  move?: (e: PointerEvent, s: PointerDragState) => void;
  /** `e` is null for a cancelled gesture (pointercancel / capture loss / abort). */
  end: (e: PointerEvent | null, s: PointerDragState) => void;
}

/** The pointer handlers returned by {@link pointerDrag}. */
export interface PointerDragHandlers {
  down(e: PointerEvent): void;
  move(e: PointerEvent): void;
  up(e: PointerEvent): void;
  /** Wire to `@pointercancel`. Also callable without an event (host-side). */
  cancel(e?: PointerEvent): void;
  /** Wire to `@lostpointercapture` — a no-op after a normal release. */
  lost(e: PointerEvent): void;
  /** Host-side reset (e.g. the remote switching devices mid-drag). */
  abort(): void;
}

/**
 * The low-level single-pointer drag gesture every continuous interaction builds
 * on (value sliders, colour wheel): capture on down, track ONE pointer by its
 * pointerId — a second finger / palm touch is ignored instead of hijacking the
 * gesture — and end exactly once.
 *
 * Touch requirements, learned the hard way:
 * - The surface MUST carry `touch-action: none` (`touch-none`). Anything looser
 *   (`pan-y`) lets the browser claim a slightly-vertical drag for scrolling and
 *   fire `pointercancel` mid-gesture — the drag dies under the finger.
 * - `@lostpointercapture` always fires after a normal release too. The active
 *   flag is cleared BEFORE `end()` runs, so the trailing `lost` is a no-op; only
 *   a mid-drag capture loss (matching pointerId, still active) cancels.
 * @param opts — `{ slop?, captureEl?, start?, move?, end }`
 * @returns `{ down, move, up, cancel, lost, abort }` pointer handlers
 */
export function pointerDrag({
  slop = 4,
  captureEl,
  start,
  move,
  end,
}: PointerDragOptions): PointerDragHandlers {
  let s: PointerDragState | null = null;
  const finish = (e: PointerEvent | null): void => {
    if (!s) return;
    const done = s;
    s = null; // clear first — the trailing lostpointercapture must see no gesture
    end(e, done);
  };
  return {
    down(e) {
      if (s) return; // one pointer owns the gesture; ignore extra fingers
      const st: PointerDragState = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
      if (start && start(e, st) === false) return;
      s = st;
      capturePointer(
        (captureEl ? captureEl(e) : null) || (e.currentTarget as Element),
        e.pointerId,
      );
    },
    move(e) {
      if (!s || e.pointerId !== s.pointerId) return;
      if (!s.moved) {
        const dx = e.clientX - s.startX;
        const dy = e.clientY - s.startY;
        s.moved = dx * dx + dy * dy >= slop * slop;
      }
      if (move) move(e, s);
    },
    up(e) {
      if (!s || e.pointerId !== s.pointerId) return;
      finish(e);
    },
    cancel(e) {
      if (!s || (e && e.pointerId !== s.pointerId)) return;
      finish(null);
    },
    lost(e) {
      // After a normal release `s` is already null; only a genuine mid-drag
      // capture loss (our pointer, gesture still active) cancels.
      if (!s || e.pointerId !== s.pointerId) return;
      finish(null);
    },
    abort() {
      finish(null);
    },
  };
}

/** The pointer handlers returned by {@link sliderDrag}. */
export interface SliderDragHandlers {
  down(e: PointerEvent): void;
  move(e: PointerEvent): void;
  up(e: PointerEvent): void;
  cancel(e?: PointerEvent): void;
  /** Wire to `@lostpointercapture` — cancels only a genuine mid-drag capture loss. */
  lost(e: PointerEvent): void;
  abort(): void;
}

/** Options (callbacks) for {@link sliderDrag}. */
export interface SliderDragOptions {
  /** Pointer event → the absolute value at that track position. */
  read: (e: PointerEvent) => number;
  /**
   * The value the gesture starts from (usually the currently displayed value).
   * When given, dragging is RELATIVE: the value follows the finger's delta from
   * wherever it landed, instead of teleporting to the touch position. A
   * stationary tap still sets the tapped position (tap-to-set).
   */
  base?: () => number;
  /** Clamp/snap `base + delta` into the value space. Default: clamp to [0,100]. */
  clampValue?: (v: number) => number;
  frame: (value: number | null, dragging: boolean) => void;
  live: (value: number) => void;
  end: (value: number | null) => void;
  guard?: () => boolean;
}

/**
 * The shared pointer-drag gesture for the value sliders (brightness / number /
 * remote volume), built on {@link pointerDrag}: capture on down, live-track
 * through the caller's debounce once the pointer clears the slop
 * (leading-suppressed — a stationary tap commits exactly once, on release),
 * final value wins on release. With `base` the drag is relative — grab anywhere
 * on the track and the value adjusts from where it was, no jump.
 *
 *   this._drag = sliderDrag({
 *     guard: () => this._unavail(),                             // optional
 *     read: (e) => Math.round(pctFromX(e.clientX, e.currentTarget)),
 *     base: () => this._displayPct(),                           // relative drag
 *     frame: (v, dragging) => { this._dragging = dragging; if (v != null) this._dragPct = v; },
 *     live: (v) => this._debouncedCommit(v),                    // streamed mid-drag
 *     end: (v) => { this._debouncedCommit.cancel(); if (v != null) this._commit(v); },
 *   });
 *   // wire: onDown: drag.down, onMove: drag.move, onUp: drag.up,
 *   //       onCancel: drag.cancel, onLost: drag.lost
 *
 * The slider surface must carry `touch-none` (see {@link pointerDrag}).
 * `end(null)` signals a cancelled gesture: drop the pending debounced write,
 * commit nothing. `abort()` is for host-side resets.
 * @param opts — `{ read, base?, clampValue?, frame, live, end, guard? }`
 * @returns `{ down, move, up, cancel, lost, abort }` pointer handlers
 */
export function sliderDrag({
  read,
  base,
  clampValue,
  frame,
  live,
  end,
  guard,
}: SliderDragOptions): SliderDragHandlers {
  const clampV =
    clampValue || ((v: number): number => Math.max(0, Math.min(100, v)));
  let v0 = 0; // value at gesture start (base, else the tapped position)
  let read0 = 0; // track value under the pointer at gesture start
  const valueAt = (e: PointerEvent, s: PointerDragState): number =>
    // Relative while dragging; a stationary tap (no slop cleared) sets the
    // tapped position on release instead.
    s.moved && base ? clampV(v0 + (read(e) - read0)) : clampV(read(e));
  return pointerDrag({
    start: (e) => {
      if (guard && guard()) return false;
      read0 = read(e);
      v0 = base ? base() : read0;
      frame(v0, true); // relative mode: the knob holds its value — no jump
      return true;
    },
    move: (e, s) => {
      if (!s.moved) return; // sub-slop jitter: neither the knob nor a commit moves
      const v = valueAt(e, s);
      frame(v, true);
      live(v);
    },
    end: (e, s) => {
      if (!e) {
        frame(null, false);
        end(null);
        return;
      }
      const v = valueAt(e, s);
      frame(v, false);
      end(v);
    },
  });
}

/** Options for {@link setupSlider}. */
export interface SliderControllerOptions {
  /** The Lit host — receives the SliderHold controller and re-render requests. */
  host: ReactiveControllerHost;
  /** Pointer event → the absolute value at that track position. */
  read: (e: PointerEvent) => number;
  /** The currently displayed value — the relative drag starts from it. */
  base: () => number;
  /** Clamp/snap into the value space. Default: clamp to [0,100]. */
  clampValue?: (v: number) => number;
  /**
   * The service call for a value. The factory arms the hold before calling and
   * clears it when the returned promise rejects — the committer stays a plain
   * service call.
   */
  commit: (v: number) => Promise<unknown> | void;
  guard?: () => boolean;
  /** Debounce for live/keyboard commits. Default 150ms. */
  debounceMs?: number;
  /** SliderHold tuning. Default `{ tolerance: 2, timeout: 5000 }`. */
  hold?: SliderHoldOptions;
}

/** The pre-wired slider control returned by {@link setupSlider}. */
export interface SliderController {
  /** Pointer handlers for the track (down/move/up/cancel/lost/abort). */
  drag: SliderDragHandlers;
  /** The optimistic display hold — exposed for host-side holds/clears. */
  hold: SliderHold;
  /** Keyboard path: arm the hold now, debounce the write (auto-repeat safe). */
  input(v: number): void;
  /** Immediate commit (hold armed, rejection-cleared) — for stepper buttons. */
  commitNow(v: number): void;
  /** The value to display for `entityValue`, drag/hold state applied. */
  value(entityValue: number, gone?: boolean): number;
  /** True while a pointer drag is live (grows the knob, shows the bubble). */
  readonly dragging: boolean;
  /** Drop any trailing debounced write — call from disconnectedCallback. */
  dispose(): void;
}

/**
 * The full slider wiring every value slider repeated by hand: one SliderHold,
 * one debounced committer (armed-hold + rejection-clear built in), one
 * {@link sliderDrag} in relative mode, and the keyboard path. Construct ONCE per
 * card (`if (!this._slider)`) — setConfig runs per editor keystroke and a fresh
 * SliderHold each time would stack controllers on the host. Callbacks close over
 * `this`, so a re-config needs no rebuild; call `.hold.clear()` instead.
 *
 *   // setConfig:
 *   if (!this._slider)
 *     this._slider = setupSlider({
 *       host: this,
 *       guard: () => this._unavail(),
 *       read: (e) => Math.round(pctFromX(e.clientX, e.currentTarget as Element)),
 *       base: () => this._displayPct(),
 *       commit: (v) => setLightBrightness(this.hass, this.config.entity, v),
 *     });
 *   else this._slider.hold.clear();
 * @param opts — see {@link SliderControllerOptions}
 * @returns the pre-wired {@link SliderController}
 */
export function setupSlider(o: SliderControllerOptions): SliderController {
  const hold = new SliderHold(
    o.host,
    o.hold || { tolerance: 2, timeout: 5000 },
  );
  let dragging = false;
  let dragValue = 0;
  const doCommit = (v: number): void => {
    hold.hold(v); // show the committed value until the entity catches up
    const p = o.commit(v);
    // A failed service call must not freeze the display on the optimistic value.
    if (p) Promise.resolve(p).catch(() => hold.clear());
  };
  const debounced = debounce(
    doCommit,
    o.debounceMs != null ? o.debounceMs : 150,
  );
  const drag = sliderDrag({
    read: o.read,
    base: o.base,
    clampValue: o.clampValue,
    guard: o.guard,
    frame: (v, d) => {
      dragging = d;
      if (v != null) dragValue = v;
      o.host.requestUpdate();
    },
    live: (v) => debounced(v),
    end: (v) => {
      if (v == null) {
        debounced.cancel();
        return;
      }
      debounced(v); // pending = release value
      debounced.flush(); // commit now (deduped vs the live commit)
    },
  });
  return {
    drag,
    hold,
    input(v) {
      // Arm the hold now (display advances, held keys keep stepping) but debounce
      // the write — key auto-repeat fired ~30 service calls a second raw.
      hold.hold(v);
      debounced(v);
    },
    commitNow: doCommit,
    value: (entityValue, gone) =>
      hold.value(entityValue, { dragging, dragValue, gone }),
    get dragging() {
      return dragging;
    },
    dispose() {
      debounced.cancel();
    },
  };
}

/** The value-space passed to {@link stepFromKey}. */
export interface StepRange {
  value: number;
  min: number;
  max: number;
  step: number;
}

/**
 * Arrow/Home/End/PageUp-Down → a new value, clamped to [min,max]. Shared by every
 * slider so keyboard behaviour is identical. PageUp/Down jump by a tenth of the
 * range (or one step, whichever is larger). Returns null for keys we don't handle,
 * so the caller can ignore them.
 * @param key — KeyboardEvent.key
 * @param range — `{ value, min, max, step }`
 * @returns clamped next value, or null
 */
export function stepFromKey(
  key: string,
  { value, min, max, step }: StepRange,
): number | null {
  const big = Math.max(step, (max - min) / 10);
  let next: number;
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      next = value + step;
      break;
    case "ArrowLeft":
    case "ArrowDown":
      next = value - step;
      break;
    case "PageUp":
      next = value + big;
      break;
    case "PageDown":
      next = value - big;
      break;
    case "Home":
      next = min;
      break;
    case "End":
      next = max;
      break;
    default:
      return null;
  }
  return Math.min(max, Math.max(min, next));
}

/** Options for {@link sliderTrack}. */
export interface SliderTrackOptions {
  pct: number;
  disabled?: boolean;
  cls?: string;
  onDown?: (e: PointerEvent) => void;
  onMove?: (e: PointerEvent) => void;
  onUp?: (e: PointerEvent) => void;
  onCancel?: (e: PointerEvent) => void;
  /** `@lostpointercapture` — pass `drag.lost` so a normal release can't cancel. */
  onLost?: (e: PointerEvent) => void;
  dragging?: boolean;
  gradient?: string;
  label?: string;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  valueText?: string;
  onInput?: (value: number) => void;
}

/**
 * The 6px drag track shared by the brightness / number / volume sliders: an
 * accent fill and knob positioned at `pct` (0-100), with pointer handlers wired
 * by the caller. Purely presentational — the caller owns pct↔value mapping and
 * the service call. Passing the value-space (value/min/max/step) + onInput
 * upgrades it to a keyboard-driven role="slider". Pass `dragging` (the card's own
 * drag flag) to grow the knob and reveal the live value bubble mid-drag.
 * @param opts — see destructured params
 * @returns lit-html template
 */
export function sliderTrack({
  pct,
  disabled = false,
  cls = "",
  onDown,
  onMove,
  onUp,
  onCancel,
  onLost,
  dragging = false,
  // A CSS background (e.g. a warm→cool or rainbow gradient) paints the whole track
  // instead of the accent fill — for colour-temperature / hue sliders. The knob
  // turns white-with-ring so it reads on any colour.
  gradient,
  // Accessibility (optional but recommended). Give the value-space (value/min/max/
  // step) + onInput(newValue) and the track becomes a real, keyboard-driven
  // role="slider"; label/valueText feed the screen-reader announcement.
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  valueText,
  onInput,
}: SliderTrackOptions): TemplateResult {
  const keydown =
    disabled || !onInput
      ? undefined
      : (e: KeyboardEvent) => {
          const next = stepFromKey(e.key, {
            value: value as number,
            min,
            max,
            step,
          });
          if (next == null) return;
          e.preventDefault();
          if (next !== value) onInput(next);
        };
  // The bubble text — the caller's valueText (e.g. "72%", "21.5 °C", "1:24"), else
  // the raw percentage. Shown while dragging (JS flag) or on keyboard focus (CSS).
  const bubbleText = valueText != null ? valueText : `${Math.round(pct)}%`;
  // aria-valuenow: the value-space value if given, else the rounded percentage.
  // Always present — role="slider" REQUIRES it (axe: aria-required-attr), and a
  // disabled slider still has a position worth announcing.
  const ariaValueNow = value != null ? value : Math.round(pct);
  // The element carrying role="slider" + the pointer handlers is a 44px-tall
  // transparent wrapper (a real touch target); the painted 6px bar is an inert
  // child. pctFromX still measures e.currentTarget (the wrapper) — same width, so
  // the maths is unchanged. `group` lets the bubble reveal on keyboard focus.
  // touch-none, not pan-y: a slightly-vertical touch drag must stay a drag — with
  // pan-y the browser claims it for scrolling and pointercancels the gesture.
  return html`<div
    class="group relative flex h-[var(--fib-hit)] cursor-pointer touch-none items-center
           ${cls} ${disabled ? "pointer-events-none" : ""}"
    role="slider"
    tabindex=${disabled ? -1 : 0}
    aria-label=${label || "slider"}
    aria-valuemin=${min}
    aria-valuemax=${max}
    aria-valuenow=${ariaValueNow}
    aria-valuetext=${disabled || valueText == null ? nothing : valueText}
    aria-disabled=${disabled ? "true" : "false"}
    @pointerdown=${onDown}
    @pointermove=${onMove}
    @pointerup=${onUp}
    @pointercancel=${onCancel}
    @lostpointercapture=${onLost || onCancel}
    @keydown=${keydown}
  >
    <div
      class="pointer-events-none relative w-full rounded-[3px]
             ${gradient ? "h-2.5" : "h-1.5 bg-[#2C3639]"}"
      style=${gradient ? `background:${gradient}` : nothing}
    >
      ${
        gradient
          ? ""
          : html`<div
              class="absolute bottom-0 left-0 top-0 rounded-[3px] bg-accent
                     ${disabled ? "opacity-40" : ""}"
              style="width:${pct}%"
            ></div>`
      }
      <!-- live value bubble above the knob: visible while dragging or on keyboard
           focus, tabular so digits don't jitter. Suppressed while disabled. -->
      ${
        disabled
          ? ""
          : html`<div
              class="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2
                     whitespace-nowrap rounded-md border border-line bg-card2 px-2 py-1
                     text-[11px] font-semibold tabular-nums text-ink
                     shadow-[0_2px_10px_rgba(0,0,0,.5)] transition-[opacity,transform]
                     duration-100 group-focus-visible:scale-100
                     group-focus-visible:opacity-100
                     ${dragging ? "scale-100 opacity-100" : "scale-90 opacity-0"}"
              style="left:${pct}%"
            >
              ${bubbleText}
            </div>`
      }
      <!-- knob: always drawn (dimmed when disabled) so a disabled slider reads as
           disabled, not broken. -->
      <div
        class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full
               shadow-[0_1px_4px_rgba(0,0,0,.55)] transition-[width,height] duration-100
               ${gradient ? "border-2 border-[rgba(0,0,0,.45)] bg-white" : "bg-accent"}
               ${dragging ? "h-[22px] w-[22px]" : "h-[18px] w-[18px]"}
               ${disabled ? "opacity-40" : ""}"
        style="left:${pct}%"
      ></div>
    </div>
  </div>`;
}

/**
 * Roving-focus keyboard nav for a chip row: arrows move focus between chips,
 * Escape runs `onClose` (shuts a drawer). composedPath() finds the focused chip
 * across the shadow boundary.
 * @param e
 * @param onClose
 */
function chipKeyNav(e: KeyboardEvent, onClose?: (() => void) | null): void {
  if (e.key === "Escape") {
    if (onClose) onClose();
    return;
  }
  const delta: Record<string, number> = {
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1,
  };
  if (!(e.key in delta)) return;
  const btns = [...(e.currentTarget as Element).querySelectorAll("button")];
  const focused = e
    .composedPath()
    .find((el) => btns.includes(el as HTMLButtonElement));
  const idx = btns.indexOf(focused as HTMLButtonElement);
  if (idx < 0) return;
  e.preventDefault();
  btns[(idx + delta[e.key] + btns.length) % btns.length].focus();
}

/** A single chip item rendered by {@link overflowChips}. */
export interface ChipItem {
  name: string;
  source?: string;
  icon?: string;
}

/** Options for {@link overflowChips}. */
export interface OverflowChipsOptions {
  hl: unknown;
  all: ChipItem[];
  collapsed?: ChipItem[] | null;
  activeValue?: string | null;
  open?: boolean;
  onToggle?: () => void;
  onSelect: (item: ChipItem) => void;
}

/**
 * A wrapping chip row (sources / apps) that collapses to `collapsed` and, when
 * there's more, shows a drawer toggle — reusing fibbers-scene's "All {n}" / "Less"
 * wording — that reveals `all`. The active chip is highlighted the same way
 * fibbers-scene marks the active scene. `collapsed` = null shows everything with
 * no drawer. Items are `{ name, source?, icon? }`; `onSelect(item)` is the caller's.
 * @param opts — see destructured params
 * @returns lit-html template
 */
export function overflowChips({
  hl,
  all,
  collapsed,
  activeValue,
  open,
  onToggle,
  onSelect,
}: OverflowChipsOptions): TemplateResult {
  const valueOf = (s: ChipItem): string => s.source || s.name;
  // By set membership, not length: `collapsed` may synthesise favourites not in
  // `all`, so a length compare could hide real overflow.
  const shownSet = collapsed && new Set(collapsed.map(valueOf));
  const hasMore = !!shownSet && all.some((a) => !shownSet.has(valueOf(a)));
  const shown = open || !collapsed ? all : collapsed;
  const chip = (s: ChipItem): TemplateResult => {
    const active = activeValue != null && activeValue === valueOf(s);
    return html`<button
      type="button"
      aria-label=${s.name}
      aria-pressed=${active ? "true" : "false"}
      class="fib-hit inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[5px]
             text-[10.5px] font-medium ${pressable({ hover: "bright" })} ${
               active
                 ? "border-accentline bg-accentbg text-accent"
                 : "border-line bg-card2 text-ink2"
             }"
      @click=${() => onSelect(s)}
    >
      ${
        s.icon
          ? html`<fib-icon
              class="h-[13px] w-[13px] [--mdc-icon-size:13px]"
              icon=${s.icon}
            ></fib-icon>`
          : ""
      }
      ${s.name}
    </button>`;
  };
  return html`<div
    class="flex flex-wrap gap-x-1.5 gap-y-[18px]"
    @keydown=${(e: KeyboardEvent) => chipKeyNav(e, open ? onToggle : null)}
  >
    ${shown.map(chip)}
    ${
      hasMore
        ? html`<button
            type="button"
            aria-expanded=${open ? "true" : "false"}
            class="fib-hit inline-flex items-center gap-1 rounded-full border border-line bg-transparent
                 px-2.5 py-[5px] text-[10.5px] font-medium text-ink2 ${pressable(
                   { hover: "tint" },
                 )}"
            @click=${onToggle}
          >
            ${
              open
                ? t(hl, "scene.show_less")
                : t(hl, "common.show_all", { n: all.length })
            }
            <fib-icon
              class="h-[13px] w-[13px] [--mdc-icon-size:13px] transition-transform ${
                open ? "rotate-180" : ""
              }"
              icon="solar:alt-arrow-down-bold-duotone"
            ></fib-icon>
          </button>`
        : ""
    }
  </div>`;
}

/** Options for {@link pillSwitch}. */
export interface PillSwitchOptions {
  on: boolean;
  onClick: (e: Event) => void;
  label?: string;
}

/**
 * The pill toggle (first grown inside fibbers-scheduler): a 36×20 track with an
 * animated 16px thumb. `on` drives colour + thumb position. Purely presentational
 * — the caller owns the service call.
 * @param opts — `{ on, onClick, label }`
 * @returns lit-html template
 */
export function pillSwitch({
  on,
  onClick,
  label = "",
}: PillSwitchOptions): TemplateResult {
  return html`<button
    type="button"
    class="fib-hit relative h-5 w-9 flex-none rounded-full transition-colors
           ${pressable({ hover: "bright" })} ${on ? "bg-accent" : "bg-card2"}"
    role="switch"
    aria-checked=${on ? "true" : "false"}
    aria-label=${label || "toggle"}
    @click=${onClick}
  >
    <span
      class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all
             ${on ? "left-[18px]" : "left-0.5"}"
    ></span>
  </button>`;
}
