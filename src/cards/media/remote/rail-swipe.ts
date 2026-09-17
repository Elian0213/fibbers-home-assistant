/* ================================================================== *
 * fibbers-remote — the nav bar's slide-to-switch gesture (core/body-layer's
 * wireSwipe) on the device rail: put a finger anywhere on the rail and drag, and a
 * floating pill follows it, morphing between the tabs; release snaps to the nearest
 * one and commits, a flick advances at least one. Same touch model as wireSwipe —
 * slop, directional lock, capture only for mouse (touch rides the pointerdown
 * target's implicit capture), only the rail's own capture loss cancels — and the
 * same drag-swallows-the-click guard, so a swipe that lifts over a tab never also
 * presses it. Taps and the keyboard path are untouched.
 *
 * Mid-drag paint goes through data-* attributes and the pill's inline style, never
 * through Lit — the template binds neither, so a hass-driven re-render mid-drag
 * can't clobber the live state.
 * ================================================================== */
import type { ReactiveController, ReactiveControllerHost } from "lit";

import { capturePointer } from "@shared/util";

const SLOP = 6; // px before a press becomes a drag (below: it's a tap)
const FLICK_V = 0.4; // px/ms — a throw faster than this advances one tab
const FLICK_STALE_MS = 120; // ignore the throw if the finger paused before lifting
const RUBBER = 0.25; // drag ratio past the first / last tab (lower = firmer edge)
const SETTLE_MS = 180; // pill settle-to-target slide; then the static style takes over

/** One tab's pill geometry, relative to the rail's padding box. */
interface Geo {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What the gesture needs from the card: page count, selection, and the announcing
 *  commit path (`slideSelect`, same as the deck swipe — the drag moves no focus, so
 *  the live region is the only thing that voices the change). */
export interface RailSwipeHost extends ReactiveControllerHost {
  count(): number;
  index(): number;
  slideSelect(i: number): void;
}

/**
 * Slide-to-switch on the device rail. Construct once (setConfig) and wire onto the
 * rail via the `attach` ref and the pre-bound pointer handlers, like SlideController.
 */
export class RailSwipe implements ReactiveController {
  private host: RailSwipeHost;

  private rail?: HTMLElement;

  // gesture state (non-reactive — mid-drag paint never goes through Lit)
  private pid = -1;

  private geo: Geo[] = [];

  private startIdx = 0;

  private curIdx = 0;

  private baseX = 0;

  private downX = 0;

  private downY = 0;

  private moved = false;

  private vx = 0; // last-sampled horizontal velocity (px/ms)

  private lastX = 0;

  private lastT = 0;

  private swallow = false; // a real drag just happened → eat the trailing click

  private settleTimer?: ReturnType<typeof setTimeout>;

  constructor(host: RailSwipeHost) {
    this.host = host;
    host.addController(this);
  }

  /** ReactiveController teardown — a half-finished drag must not resume. */
  hostDisconnected(): void {
    this.abort();
  }

  /** lit `ref` callback: cache the rail (or clear it on unbind) and wire the
   *  capture-phase click-swallow guard, exactly like SlideController.attach. */
  readonly attach = (el?: Element): void => {
    if (this.rail) this.rail.removeEventListener("click", this._onClick, true);
    this.rail = el ? (el as HTMLElement) : undefined;
    if (this.rail) this.rail.addEventListener("click", this._onClick, true);
  };

  private readonly _onClick = (e: MouseEvent): void => {
    if (!this.swallow) return;
    this.swallow = false;
    e.stopPropagation();
    e.preventDefault();
  };

  private _tabs(): HTMLElement[] {
    return this.rail
      ? [...this.rail.querySelectorAll<HTMLElement>('[role="tab"]')]
      : [];
  }

  private _ind(): HTMLElement | null {
    return this.rail?.querySelector<HTMLElement>(".rind") ?? null;
  }

  /** Pointer-down: capture the tab geometry and arm the gesture (no capture yet —
   *  a tap must keep its native click; see wireSwipe's onDown). */
  readonly down = (e: PointerEvent): void => {
    if (this.pid !== -1 || this.host.count() < 2) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const tabs = this._tabs();
    if (tabs.length < 2) return;
    // offsetLeft/Top are relative to the rail (its position:relative makes it the
    // offsetParent) — the same origin the absolutely-positioned pill resolves against.
    this.geo = tabs.map((b) => ({
      x: b.offsetLeft,
      y: b.offsetTop,
      w: b.offsetWidth,
      h: b.offsetHeight,
    }));
    this.startIdx = Math.max(
      0,
      Math.min(this.geo.length - 1, this.host.index()),
    );
    this.curIdx = this.startIdx;
    this.baseX = this.geo[this.startIdx].x;
    this.pid = e.pointerId;
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.moved = false;
    this.swallow = false; // clear a stale swallow from a drag that fired no click
    this.vx = 0;
    this.lastX = e.clientX;
    this.lastT = e.timeStamp;
    clearTimeout(this.settleTimer);
  };

  /** Pointer-move: clear the slop, lock the axis, then follow the finger. */
  readonly move = (e: PointerEvent): void => {
    if (e.pointerId !== this.pid) return;
    const dx = e.clientX - this.downX;
    const dy = e.clientY - this.downY;
    if (!this.moved) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SLOP) return; // still a tap
      // Directional lock: a mostly-vertical first move is a dashboard scroll, not a
      // tab slide — drop the gesture (touch-action: pan-y hands it to the browser).
      if (Math.abs(dy) > Math.abs(dx)) {
        this.pid = -1;
        return;
      }
      this.moved = true;
      // Capture only for MOUSE (the wireSwipe rule): touch/pen give the pointerdown
      // target implicit capture, whose events bubble through the rail — stealing it
      // fires a bubbling lostpointercapture into our own cancel handler.
      if (e.pointerType === "mouse") capturePointer(this.rail, e.pointerId);
      if (this.rail) this.rail.dataset.drag = "";
      const ind = this._ind();
      if (ind) {
        ind.style.transition = "none"; // follow the finger 1:1
        ind.style.opacity = "1";
      }
    }
    const dt = e.timeStamp - this.lastT;
    if (dt > 0) {
      this.vx = (e.clientX - this.lastX) / dt;
      this.lastX = e.clientX;
      this.lastT = e.timeStamp;
    }
    this._paint(this._railX(this.baseX + dx));
  };

  /** Pointer-up: a tap passes through untouched; a drag snaps + commits. */
  readonly up = (e: PointerEvent): void => {
    if (e.pointerId !== this.pid) return;
    const wasMoved = this.moved;
    this.pid = -1;
    this.moved = false;
    if (!wasMoved) return; // stationary tap — the button's own @click selects
    this.swallow = true; // a real drag: eat the trailing synthetic click
    let target = this._nearest(this.baseX + (e.clientX - this.downX));
    // A decisive flick advances at least one tab in the throw direction — but only
    // if the finger was still moving at release (a pause leaves vx stale).
    if (
      e.timeStamp - this.lastT < FLICK_STALE_MS &&
      Math.abs(this.vx) > FLICK_V
    ) {
      target =
        this.vx > 0
          ? Math.min(this.geo.length - 1, Math.max(target, this.startIdx + 1))
          : Math.max(0, Math.min(target, this.startIdx - 1));
    }
    this._settle(target);
    if (target !== this.host.index()) this.host.slideSelect(target);
  };

  /** Pointer-cancel (the browser claimed the gesture): drop it. */
  readonly cancel = (e: PointerEvent): void => {
    if (e.pointerId !== this.pid) return;
    this.abort();
  };

  /** Lost capture — but only the rail's own. lostpointercapture BUBBLES: a tab
   *  releasing its implicit touch capture (every tap release) reaches this listener
   *  too, and that's not our loss. */
  readonly lost = (e: PointerEvent): void => {
    if (e.target !== this.rail) return;
    this.abort();
  };

  /** Kill any live drag and restore the resting rail. */
  abort(): void {
    this.pid = -1;
    this.moved = false;
    clearTimeout(this.settleTimer);
    this._rest();
  }

  // Rubber-band the pill's left-x past the first/last tab.
  private _railX(x: number): number {
    const minX = this.geo[0].x;
    const maxX = this.geo[this.geo.length - 1].x;
    if (x < minX) return minX - (minX - x) * RUBBER;
    if (x > maxX) return maxX + (x - maxX) * RUBBER;
    return x;
  }

  // Fractional tab index for a pill left-x, so the pill can morph between tabs.
  private _frac(x: number): number {
    if (x <= this.geo[0].x) return 0;
    for (let i = 1; i < this.geo.length; i++) {
      if (x <= this.geo[i].x) {
        const span = this.geo[i].x - this.geo[i - 1].x || 1;
        return i - 1 + (x - this.geo[i - 1].x) / span;
      }
    }
    return this.geo.length - 1;
  }

  private _nearest(x: number): number {
    return Math.max(
      0,
      Math.min(this.geo.length - 1, Math.round(this._frac(x))),
    );
  }

  // Pill geometry at a left-x — interpolated between the two straddled tabs, or the
  // end tab's size (translated) while rubber-banding past an edge.
  private _interp(x: number): Geo {
    const first = this.geo[0];
    const last = this.geo[this.geo.length - 1];
    if (x <= first.x) return { ...first, x };
    if (x >= last.x) return { ...last, x };
    const f = this._frac(x);
    const i0 = Math.floor(f);
    const i1 = Math.min(i0 + 1, this.geo.length - 1);
    const t = f - i0;
    const lerp = (a: number, b: number): number => a + (b - a) * t;
    return {
      x,
      y: lerp(this.geo[i0].y, this.geo[i1].y),
      w: lerp(this.geo[i0].w, this.geo[i1].w),
      h: lerp(this.geo[i0].h, this.geo[i1].h),
    };
  }

  // Paint one frame: the pill at `x`, and the tab under it reading accent
  // (data-over — an attribute the template never binds, so Lit can't clobber it).
  private _paint(x: number): void {
    const ind = this._ind();
    if (ind) {
      const g = this._interp(x);
      ind.style.width = `${g.w}px`;
      ind.style.height = `${g.h}px`;
      ind.style.transform = `translate(${g.x}px, ${g.y}px)`;
    }
    const ni = this._nearest(x);
    if (ni !== this.curIdx) this.curIdx = ni;
    this._tabs().forEach((b, i) => {
      if (i === ni) b.setAttribute("data-over", "");
      else b.removeAttribute("data-over");
    });
  }

  // Slide the pill onto the target tab, then hand the visuals back to the static
  // aria-selected style (which the commit's re-render has moved by then).
  private _settle(target: number): void {
    const ind = this._ind();
    const g = this.geo[target];
    if (ind && g) {
      ind.style.transition = `transform ${SETTLE_MS}ms ease, width ${SETTLE_MS}ms ease`;
      ind.style.width = `${g.w}px`;
      ind.style.height = `${g.h}px`;
      ind.style.transform = `translate(${g.x}px, ${g.y}px)`;
    }
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this._rest(), SETTLE_MS);
  }

  // Resting state: pill hidden, no drag attributes, tabs back to template styling.
  private _rest(): void {
    if (this.rail) delete this.rail.dataset.drag;
    const ind = this._ind();
    if (ind) {
      ind.style.transition = "";
      ind.style.opacity = "";
      ind.style.transform = "";
      ind.style.width = "";
      ind.style.height = "";
    }
    this._tabs().forEach((b) => b.removeAttribute("data-over"));
  }
}
