/* ================================================================== *
 * fibbers-remote — the device page-swipe deck: a Lit ReactiveController that turns a
 * horizontal drag anywhere on the remote body into a page to the next/previous
 * device. It follows the finger with a bounded, resisted translate written straight
 * to `element.style.transform` (never through Lit, zero re-renders mid-drag) and, on
 * release, animates the single live panel out, swaps its contents via the host, and
 * animates the new one in from the opposite edge.
 *
 * The one rule that protects the touchpad: the gesture DECLINES on pointerdown when
 * the press lands on a child that owns its own horizontal drag (the Siri-Remote
 * touchpad, a swipe wheel, the volume groove, any [role="slider"]). Same-axis nesting
 * can't be solved with touch-action — both gestures are horizontal and the event
 * bubbles to this ancestor regardless — so we walk the composed path and opt out.
 * ================================================================== */
import type { ReactiveController, ReactiveControllerHost } from "lit";

import { capturePointer } from "@shared/util";

import {
  lockAxis,
  emaVelocity,
  resist,
  atEdge,
  commitTarget,
} from "./deck-math";

/** Children that own their own horizontal drag and must not arm the page swipe. */
const OWN = '[data-fib-gesture="own"],[role="slider"]';

const SNAP_MS = 180; // spring-back when a drag doesn't commit
const PAGE_MS = 200; // out / in leg of a committed page change
const EASE = "cubic-bezier(.22,.61,.36,1)";
// A backgrounded tab never fires `transitionend`; this is the belt-and-braces timer.
const FALLBACK_MS = 300;

/**
 * True when the pointerdown landed on something that owns its own drag. Uses
 * `composedPath()`, not `closest()` — the card is a shadow root and `closest()`
 * stops at the boundary.
 * @param e — the pointerdown event
 * @param root — the deck surface; reaching it means nothing claimed the press
 */
export function ownedByChild(e: PointerEvent, root: Element): boolean {
  for (const n of e.composedPath()) {
    if (n === root) return false; // reached the deck: nothing claimed it
    // Duck-type `matches` rather than `instanceof Element` — the composed path also
    // carries the document and window, which have no `matches`.
    const el = n as Element;
    if (typeof el.matches === "function" && el.matches(OWN)) return true;
  }
  return false;
}

/** The card surface the deck drives. `ReactiveControllerHost` supplies
 *  addController / removeController / requestUpdate / updateComplete. */
export interface DeckHost extends ReactiveControllerHost {
  /** How many devices are in the rail (0 disables the gesture). */
  count(): number;
  /** The selected index. */
  index(): number;
  /** Commit a page change (and announce it to the live region). */
  deckSelect(i: number): void;
  /** Whether a haptic tick is wanted for a committed page change. */
  haptics(): boolean;
}

/**
 * Horizontal page gesture over the remote's device list: follows the finger with a
 * bounded, resisted translate and commits to the neighbouring device on release.
 * Declines outright when the press lands on a child that owns its own drag.
 */
export class DeckController implements ReactiveController {
  private host: DeckHost;

  private surface?: HTMLElement;

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

  private committing = false;

  private rafId = 0;

  private pendingMove: PointerEvent | null = null;

  private commitTimer?: ReturnType<typeof setTimeout>;

  private inTimer?: ReturnType<typeof setTimeout>;

  private snapTimer?: ReturnType<typeof setTimeout>;

  constructor(host: DeckHost) {
    this.host = host;
    host.addController(this);
  }

  /** ReactiveController teardown — a half-finished swipe must not resume. */
  hostDisconnected(): void {
    this.committing = false;
    this.abort();
  }

  /** lit `ref` callback: cache the surface (or clear it on unbind). */
  readonly attach = (el?: Element): void => {
    if (!el) {
      this.surface = undefined;
      return;
    }
    this.surface = el as HTMLElement;
    this.reducedMotion =
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  /** Pointer-down: arm the gesture unless a child owns it or a commit is in flight. */
  readonly down = (e: PointerEvent): void => {
    if (this.committing || this.pid !== -1) return;
    if (this.host.count() < 2) return;
    // The §B.3 gate, first: a press on a self-owning child never arms the deck.
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
    this.width = this.surface.getBoundingClientRect().width;
    // Do NOT capture the pointer yet — capturing would steal the press from a button
    // that hasn't been clicked. Capture only when the axis locks to 'x'.
  };

  /** Pointer-move: lock the axis, track velocity, and paint once per frame. */
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
      capturePointer(this.surface, e.pointerId);
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

  // One paint per animation frame, straight to the surface's inline transform.
  private readonly frame = (): void => {
    this.rafId = 0;
    if (!this.pendingMove || this.axis !== "x" || !this.surface) return;
    this.pendingMove = null;
    const edge = atEdge(this.host.index(), this.host.count(), this.currentDx);
    const x = resist(this.currentDx, this.width, edge);
    this.surface.style.transition = "none";
    this.surface.style.transform = `translate3d(${x}px,0,0)`;
  };

  /** Pointer-up: snap back, or animate the commit. */
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
      this._clearTransform();
      if (target !== sel) this.host.deckSelect(target);
      return;
    }
    if (target === sel) {
      this._snapBack();
      return;
    }
    this.committing = true;
    if (
      this.host.haptics() &&
      typeof navigator !== "undefined" &&
      navigator.vibrate
    )
      navigator.vibrate(8);
    this._animateCommit(target, target > sel ? 1 : -1);
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
    clearTimeout(this.inTimer);
    clearTimeout(this.snapTimer);
    this.pid = -1;
    this.axis = null;
    this.pendingMove = null;
    this._clearTransform();
  }

  // Spring the panel back to rest — a drag that didn't cross the commit threshold.
  private _snapBack(): void {
    const el = this.surface;
    if (!el) return;
    el.style.transition = `transform ${SNAP_MS}ms ease-out`;
    el.style.transform = "translate3d(0,0,0)";
    const end = (): void => {
      clearTimeout(this.snapTimer);
      el.removeEventListener("transitionend", end);
      el.style.transition = "";
      el.style.transform = "";
    };
    el.addEventListener("transitionend", end);
    this.snapTimer = setTimeout(end, SNAP_MS + 60);
  }

  // Animate the live panel out one full width, swap its contents through the host,
  // then bring the new panel in from the opposite edge. `dir` is +1 for next / -1 for
  // prev. `committing` stays true across the whole two-leg animation so `abort()` and
  // the host's own `select()` (which the swap calls) can't clear the transform mid-flight.
  private _animateCommit(target: number, dir: number): void {
    const el = this.surface;
    if (!el) {
      this.host.deckSelect(target);
      this.committing = false;
      return;
    }
    // transitionend and the fallback timer both funnel here; whichever wins tears
    // down the other, so the swap runs exactly once.
    const onEnd = (): void => {
      clearTimeout(this.commitTimer);
      el.removeEventListener("transitionend", onEnd);
      this.host.deckSelect(target);
      // Fire-and-forget the second leg once the new panel has rendered.
      this.host.updateComplete.then(() => this._animateIn(-dir));
    };
    el.style.transition = `transform ${PAGE_MS}ms ${EASE}`;
    el.addEventListener("transitionend", onEnd);
    this.commitTimer = setTimeout(onEnd, FALLBACK_MS);
    this._reflow(el); // so the transition applies to the change below
    el.style.transform = `translate3d(${dir > 0 ? -100 : 100}%,0,0)`;
  }

  // Second leg: the freshly-selected panel slides in from `fromDir` (±1) to rest.
  private _animateIn(fromDir: number): void {
    const el = this.surface;
    if (!el) {
      this.committing = false;
      return;
    }
    el.style.transition = "none";
    el.style.transform = `translate3d(${fromDir > 0 ? 100 : -100}%,0,0)`;
    this._reflow(el);
    el.style.transition = `transform ${PAGE_MS}ms ${EASE}`;
    el.style.transform = "translate3d(0,0,0)";
    const end = (): void => {
      clearTimeout(this.inTimer);
      el.removeEventListener("transitionend", end);
      el.style.transition = "";
      el.style.transform = "";
      this.committing = false;
    };
    el.addEventListener("transitionend", end);
    this.inTimer = setTimeout(end, FALLBACK_MS);
  }

  private _clearTransform(): void {
    if (!this.surface) return;
    this.surface.style.transition = "";
    this.surface.style.transform = "";
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
