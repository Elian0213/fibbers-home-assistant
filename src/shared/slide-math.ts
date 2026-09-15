/* ================================================================== *
 * Shared pure math for a horizontal slide / paging gesture: axis lock, velocity,
 * rubber-band resistance, edge detection and the commit target. No DOM, no state,
 * so it's unit-tested directly (slide-math.test.ts). The gesture engine that calls
 * it lives in slide-controller.ts; any card that pages a surface can reuse both.
 * ================================================================== */

/** Axis lock: 'x' only inside a 30° cone of horizontal, so a diagonal thumb scroll
 *  keeps scrolling the dashboard. null = still inside the slop, undecided. */
export const SLOP = 10; // px — matches Embla's dragThreshold
export const TAN_LIMIT = 1.732; // tan(60°): |dx| must be ≥ 1.732·|dy|

/**
 * The locked axis for a drag delta: 'x' inside a 30° cone of horizontal, 'y'
 * otherwise, null while still within the slop radius.
 * @param dx — horizontal delta from the press
 * @param dy — vertical delta from the press
 */
export function lockAxis(dx: number, dy: number): "x" | "y" | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax * ax + ay * ay < SLOP * SLOP) return null;
  return ax >= ay * TAN_LIMIT ? "x" : "y";
}

/** 70/30 EMA velocity, px/ms.
 * @param prev — the previous EMA value
 * @param dx — the last horizontal delta
 * @param dt — the elapsed time for that delta (ms)
 */
export function emaVelocity(prev: number, dx: number, dt: number): number {
  if (dt <= 0) return prev;
  return prev * 0.7 + (dx / dt) * 0.3;
}

/** Swiper-style rubber band past the first/last page (resistanceRatio 0.85).
 * @param dx — the raw horizontal drag
 * @param width — the surface width
 * @param atEdgeNow — whether this drag direction has nowhere to go
 */
export function resist(dx: number, width: number, atEdgeNow: boolean): number {
  if (!atEdgeNow || width <= 0) return dx;
  const over = Math.abs(dx) / width;
  return Math.sign(dx) * Math.abs(dx) * (1 - Math.min(0.85, over * 0.85));
}

/** True when a drag of this direction has nowhere to go (first/last page).
 * @param sel — the current index
 * @param count — the page count
 * @param dx — the drag direction (sign only)
 */
export function atEdge(sel: number, count: number, dx: number): boolean {
  return (dx < 0 && sel >= count - 1) || (dx > 0 && sel <= 0);
}

/** The index to land on. Commit on half a page of travel OR a flick. */
export const FLICK_V = 0.35; // px/ms
export const FLICK_MIN = 24; // px — a flick still needs real travel

/**
 * The index a released drag should land on: the current one unless the drag crossed
 * half the surface or was a flick with real travel; never wraps.
 * @param sel — the current index
 * @param count — the page count
 * @param dx — the horizontal travel
 * @param width — the surface width
 * @param vx — the release velocity (px/ms)
 */
export function commitTarget(
  sel: number,
  count: number,
  dx: number,
  width: number,
  vx: number,
): number {
  const far = width > 0 && Math.abs(dx) > width * 0.5;
  const flick = Math.abs(vx) > FLICK_V && Math.abs(dx) > FLICK_MIN;
  if (!far && !flick) return sel;
  const next = sel + (dx < 0 ? 1 : -1); // drag left → next page
  return next < 0 || next >= count ? sel : next; // never wrap
}
