/* ================================================================== *
 * Shared horizontal slide / paging controller: a Lit ReactiveController that turns a
 * horizontal drag on a surface into a page to the neighbouring item. On the first
 * horizontal move it asks the host to render the neighbouring panel beside the current
 * one inside a translatable track, then follows the finger by translating that track
 * straight through `element.style` (never through Lit, zero re-renders mid-drag) — so
 * the neighbour is already on screen as you drag, no blank. On release it runs ONE
 * continuous, velocity-aware ease-out to the chosen page (iOS-style), then swaps the
 * selection via the host and drops the neighbour. Reused by any card that pages a
 * surface (the remote's device deck).
 *
 * The rule that lets a slider live INSIDE a sliding surface: the gesture DECLINES on
 * pointerdown when the press lands on a child that owns its own horizontal drag (a
 * touchpad, a swipe wheel, a groove, any [role="slider"]). Same-axis nesting can't be
 * solved with touch-action — both gestures are horizontal and the event bubbles to
 * this ancestor regardless — so we walk the composed path and opt out.
 *
 * A real drag also swallows the trailing `click` (a capture-phase guard, like the nav
 * bar's), so a swipe that lifts over a button never also presses it.
 * ================================================================== */
import type { ReactiveController, ReactiveControllerHost } from "lit";

import { capturePointer } from "@shared/util";

import {
  lockAxis,
  emaVelocity,
  resist,
  atEdge,
  commitTarget,
} from "@shared/slide-math";

/** Children that own their own horizontal drag and must not arm the page swipe. */
const OWN = '[data-fib-gesture="own"],[role="slider"]';

const MIN_MS = 180; // shortest snap (a fast flick)
const MAX_MS = 420; // longest snap (a slow, near-full-width drag)
const V_FLOOR = 0.1; // px/ms — a velocity floor so a slow release still resolves briskly
const EASE = "cubic-bezier(.22,.61,.36,1)"; // strong-ish ease-out — native paging feel
// A backgrounded tab never fires `transitionend`; this pads the dynamic duration for
// the belt-and-braces timer.
const FALLBACK_PAD = 120;

/**
 * True when the pointerdown landed on something that owns its own drag. Uses
 * `composedPath()`, not `closest()` — the card is a shadow root and `closest()`
 * stops at the boundary.
 * @param e — the pointerdown event
 * @param root — the slide surface; reaching it means nothing claimed the press
 */
export function ownedByChild(e: PointerEvent, root: Element): boolean {
  for (const n of e.composedPath()) {
    if (n === root) return false; // reached the surface: nothing claimed it
    // Duck-type `matches` rather than `instanceof Element` — the composed path also
    // carries the document and window, which have no `matches`.
    const el = n as Element;
    if (typeof el.matches === "function" && el.matches(OWN)) return true;
  }
  return false;
}

/** The card surface the slide drives. `ReactiveControllerHost` supplies
 *  addController / removeController / requestUpdate / updateComplete. */
export interface SlideHost extends ReactiveControllerHost {
  /** How many pages there are (0 or 1 disables the gesture). */
  count(): number;
  /** The selected index. */
  index(): number;
  /** Commit a page change (and announce it, move focus, etc.). */
  slideSelect(i: number): void;
  /** Render the neighbouring page `i` beside the current one (null clears it). */
  peek(i: number | null): void;
  /** Whether a haptic tick is wanted for a committed page change. */
  haptics(): boolean;
}

/**
 * Horizontal page gesture over a list of items: stages the neighbour in the drag
 * direction, follows the finger by translating the track, and commits to that
 * neighbour on release with a single continuous slide. Declines outright when the
 * press lands on a child that owns its own drag.
 */
export class SlideController implements ReactiveController {
  private host: SlideHost;

  // The pointer/measurement surface (the clipping `.deck`): width, capture, click-swallow
  // and the reserved height live here. The translated element is `track`.
  private surface?: HTMLElement;

  // The translated element (the `.track` inside the surface). Transforms go here.
  private track?: HTMLElement;

  private reducedMotion = false;

  // gesture state (non-reactive — nothing here triggers a render mid-drag)
  private pid = -1;

  private downX = 0;

  private downY = 0;

  private lastX = 0;

  private lastT = 0;

  private currentDx = 0;

  private axis: "x" | "y" | null = null;

  private vX = 0; // EMA velocity px/ms

  private width = 0;

  // Which neighbour is staged: +1 = next (track order [cur,next], rest offset 0),
  // -1 = prev (order [prev,cur], rest offset -width), 0 = none (edge → rubber-band).
  private peekDir: 0 | 1 | -1 = 0;

  private committing = false;

  private swallow = false; // a real drag just happened → eat the trailing click

  private rafId = 0;

  private pendingMove: PointerEvent | null = null;

  private commitTimer?: ReturnType<typeof setTimeout>;

  constructor(host: SlideHost) {
    this.host = host;
    host.addController(this);
  }

  /** ReactiveController teardown — a half-finished swipe must not resume. */
  hostDisconnected(): void {
    this.committing = false;
    this.abort();
  }

  /** lit `ref` callback: cache the surface (or clear it on unbind), and wire the
   *  capture-phase click-swallow guard so a drag never doubles as a button press. */
  readonly attach = (el?: Element): void => {
    if (this.surface)
      this.surface.removeEventListener("click", this._onClick, true);
    if (!el) {
      this.surface = undefined;
      return;
    }
    this.surface = el as HTMLElement;
    this.surface.addEventListener("click", this._onClick, true);
    this.reducedMotion =
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  /** lit `ref` callback for the translated track element (or clear it on unbind). */
  readonly attachTrack = (el?: Element): void => {
    this.track = el ? (el as HTMLElement) : undefined;
  };

  // Capture phase on the surface, so it runs before the child button's own @click:
  // a click that follows a real drag is swallowed once.
  private readonly _onClick = (e: MouseEvent): void => {
    if (!this.swallow) return;
    this.swallow = false;
    e.stopPropagation();
    e.preventDefault();
  };

  /** The live surface's content height (for a host that reserves a stable height). */
  measure(): number {
    return this.surface?.scrollHeight ?? 0;
  }

  /** Reserve a minimum height on the surface so paging never shrinks the card.
   * @param px — the height to reserve (0 clears it) */
  reserve(px: number): void {
    if (this.surface) this.surface.style.minHeight = px ? `${px}px` : "";
  }

  /** Pointer-down: arm the gesture unless a child owns it or a commit is in flight. */
  readonly down = (e: PointerEvent): void => {
    if (this.committing || this.pid !== -1) return;
    if (this.host.count() < 2) return;
    // The opt-out gate, first: a press on a self-owning child never arms the slide.
    if (!this.surface || ownedByChild(e, this.surface)) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    this.pid = e.pointerId;
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.lastX = e.clientX;
    this.lastT = e.timeStamp;
    this.currentDx = 0;
    this.axis = null;
    this.vX = 0;
    this.peekDir = 0;
    this.width = this.surface.getBoundingClientRect().width;
    // Do NOT capture the pointer yet — capturing would steal the press from a button
    // that hasn't been clicked. Capture only when the axis locks to 'x'.
  };

  /** Pointer-move: lock the axis, stage the neighbour, track velocity, paint once/frame. */
  readonly move = (e: PointerEvent): void => {
    if (e.pointerId !== this.pid) return;
    if (this.axis === "y") return; // decided to let the dashboard scroll
    const dx = e.clientX - this.downX;
    const dy = e.clientY - this.downY;
    if (this.axis === null) {
      const locked = lockAxis(dx, dy);
      if (!locked) return; // still inside the slop
      if (locked === "y") {
        this.axis = "y"; // never preventDefault, never transform — dashboard scrolls
        return;
      }
      this.axis = "x";
      this.swallow = true; // a real horizontal drag → swallow the trailing click
      capturePointer(this.surface, e.pointerId);
      this._stagePeek(dx); // render the neighbour we're dragging toward, if any
    }
    // axis === 'x' from here
    if (e.cancelable) e.preventDefault();
    this.vX = emaVelocity(
      this.vX,
      e.clientX - this.lastX,
      e.timeStamp - this.lastT,
    );
    this.lastX = e.clientX;
    this.lastT = e.timeStamp;
    this.currentDx = dx;
    this.pendingMove = e;
    if (!this.rafId && typeof requestAnimationFrame !== "undefined")
      this.rafId = requestAnimationFrame(this.frame);
  };

  // On the first horizontal move, stage the page in the drag direction (left → next,
  // right → prev) if one exists. No neighbour (first/last page) → peekDir 0, and the
  // frame painter rubber-bands the lone panel instead.
  private _stagePeek(dx: number): void {
    const dir = dx < 0 ? 1 : -1;
    const neighbour = this.host.index() + dir;
    if (neighbour >= 0 && neighbour < this.host.count()) {
      this.peekDir = dir;
      this.host.peek(neighbour);
    } else {
      this.peekDir = 0;
    }
  }

  // One paint per animation frame, straight to the track's inline transform.
  private readonly frame = (): void => {
    this.rafId = 0;
    if (!this.pendingMove || this.axis !== "x" || !this.track) return;
    this.pendingMove = null;
    let x: number;
    if (this.peekDir === 0) {
      // No neighbour staged (edge): rubber-band the lone panel.
      const edge = atEdge(this.host.index(), this.host.count(), this.currentDx);
      x = resist(this.currentDx, this.width, edge);
    } else {
      // A neighbour is staged (absolutely positioned on the drag side). The current
      // panel rests at 0; follow the finger toward the neighbour, resisting the other
      // way (nothing there) so an over-drag can't reveal blank.
      x = this._clampX(this.currentDx);
    }
    this.track.style.transition = "none";
    this.track.style.transform = `translate3d(${x}px,0,0)`;
  };

  /** Pointer-up: snap back, or run the single continuous commit. */
  readonly up = (e: PointerEvent): void => {
    if (e.pointerId !== this.pid) return;
    const { axis } = this;
    const dx = this.currentDx;
    const { vX } = this;
    this._cancelRaf();
    this._releaseCapture();
    this.pid = -1;
    this.axis = null;
    this.pendingMove = null;
    if (axis !== "x") {
      this._clearTransform();
      return;
    }
    const sel = this.host.index();
    const count = this.host.count();
    const target = commitTarget(sel, count, dx, this.width, vX);
    if (this.reducedMotion) {
      this.host.peek(null);
      this._clearTransform();
      if (target !== sel) this.host.slideSelect(target);
      this.peekDir = 0;
      return;
    }
    this.committing = true;
    // No neighbour staged (edge drag), or the drag didn't cross the commit threshold:
    // spring the current panel back to rest.
    if (this.peekDir === 0 || target === sel) {
      this._animateTo(0, null);
      return;
    }
    if (
      this.host.haptics() &&
      typeof navigator !== "undefined" &&
      navigator.vibrate
    )
      navigator.vibrate(8);
    // Commit: slide the neighbour fully in — left for a next page, right for a prev. Wait
    // for the staged neighbour to finish rendering first (a fast cut-off flick can release
    // before it mounts), so it always slides IN rather than the card jumping to it.
    const endX = this.peekDir > 0 ? -this.width : this.width;
    this.host.updateComplete.then(() => this._animateTo(endX, target));
  };

  /** Pointer-cancel: drop the gesture. */
  readonly cancel = (): void => this.abort();

  /** Lost capture: drop the gesture. */
  readonly lost = (): void => this.abort();

  /** Kill any live gesture and snap home with no animation. No-op mid-commit. */
  abort(): void {
    if (this.committing) return;
    this._cancelRaf();
    this._releaseCapture();
    clearTimeout(this.commitTimer);
    this.pid = -1;
    this.axis = null;
    this.pendingMove = null;
    this.peekDir = 0;
    this.host.peek(null);
    this._clearTransform();
  }

  // Clamp the drag offset to the neighbour's side (the current panel rests at 0, the
  // neighbour sits one width toward the drag): follow the finger into the neighbour, but
  // resist (rubber-band) the other way, where there's nothing, so it can't reveal blank.
  private _clampX(dx: number): number {
    if (this.peekDir > 0) {
      // Neighbour on the right (next): valid range [-width, 0].
      if (dx > 0) return resist(dx, this.width, true);
      if (dx < -this.width)
        return -this.width + resist(dx + this.width, this.width, true);
    } else {
      // Neighbour on the left (prev): valid range [0, width].
      if (dx < 0) return resist(dx, this.width, true);
      if (dx > this.width)
        return this.width + resist(dx - this.width, this.width, true);
    }
    return dx;
  }

  // A velocity-aware duration: distance to cover ÷ release speed, clamped. A fast flick
  // finishes near MIN_MS; a slow, near-full-width drag near MAX_MS.
  private _dur(endX: number): number {
    const dist = Math.abs(endX - this.currentDx);
    const v = Math.max(Math.abs(this.vX), V_FLOOR);
    return Math.round(Math.min(MAX_MS, Math.max(MIN_MS, dist / v)));
  }

  // The single commit/snap slide: animate the track to `endX`, then (on transitionend
  // or the fallback timer) swap the selection through the host, drop the neighbour, and
  // reset the track to rest. `committing` stays true across the whole thing so `abort()`
  // and the host's own reset can't clear the transform mid-flight.
  private _animateTo(endX: number, commitTo: number | null): void {
    const el = this.track;
    if (!el) {
      this._finishSlide(commitTo);
      return;
    }
    const dur = this._dur(endX);
    const onEnd = (): void => {
      clearTimeout(this.commitTimer);
      el.removeEventListener("transitionend", onEnd);
      this._finishSlide(commitTo);
    };
    el.style.transition = `transform ${dur}ms ${EASE}`;
    el.addEventListener("transitionend", onEnd);
    this.commitTimer = setTimeout(onEnd, dur + FALLBACK_PAD);
    this._reflow(el); // so the transition applies to the change below
    el.style.transform = `translate3d(${endX}px,0,0)`;
  }

  // Swap the selection (when committing), drop the neighbour, and — once the collapsed
  // single panel has rendered — reset the track to rest. Clearing the transform right
  // after `updateComplete` (a microtask, before paint) avoids a one-frame blank.
  private _finishSlide(commitTo: number | null): void {
    if (commitTo !== null) this.host.slideSelect(commitTo);
    this.host.peek(null);
    this.host.updateComplete.then(() => {
      if (this.track) {
        this.track.style.transition = "";
        this.track.style.transform = "";
      }
      this.peekDir = 0;
      this.committing = false;
    });
  }

  private _clearTransform(): void {
    if (!this.track) return;
    this.track.style.transition = "";
    this.track.style.transform = "";
  }

  // A synchronous layout read flushes the pending style change so the next transform
  // animates from the just-set position. getBoundingClientRect() is a side-effecting
  // call (no no-void / no-unused-expressions), and forces reflow like offsetWidth.
  private _reflow(el: HTMLElement): void {
    el.getBoundingClientRect();
  }

  private _cancelRaf(): void {
    if (this.rafId && typeof cancelAnimationFrame !== "undefined")
      cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private _releaseCapture(): void {
    try {
      if (
        this.surface &&
        this.pid !== -1 &&
        this.surface.hasPointerCapture?.(this.pid)
      )
        this.surface.releasePointerCapture(this.pid);
    } catch (_) {
      /* already released — nothing to do */
    }
  }
}
