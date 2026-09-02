/* ================================================================== *
 * VIEW RESERVE — keep the pinned bottom bar from covering the last card.
 *
 * The old approach was an in-flow spacer inside the nav card, but on a multi-
 * column Sections view a spacer only adds height to *its own* column — the taller
 * column sets the scroll extent and the other column's tail slides under the bar.
 *
 * Instead we reserve on the view itself: inject padding-bottom on hui-root's
 * scroll container (#view), the same scoped shadow-root injection hide-tabs uses.
 * That clears every column at once. Removed when the last nav card detaches.
 * ================================================================== */
import { deepFind } from "./util.js";

const STYLE_ID = "fibbers-view-reserve";

const state = { px: 0, scheduled: false, observer: null };

const findHuiRoot = () => deepFind("hui-root");
const findResolvedPanel = () => deepFind("partial-panel-resolver");

/** Append or update the single injected style inside hui-root.shadowRoot. */
function paint() {
  if (!state.px) return removeStyle();
  const root = findHuiRoot();
  if (!root || !root.shadowRoot) return;
  // #view is hui-root's scroll/content container; padding-bottom there sits below
  // the whole sections grid, so it clears all columns uniformly.
  const css = `#view { padding-bottom: ${state.px}px !important; }`;
  let style = root.shadowRoot.getElementById(STYLE_ID);
  if (style) {
    if (style.textContent !== css) style.textContent = css; // idempotent update
    return;
  }
  style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  root.shadowRoot.appendChild(style);
}

function removeStyle() {
  const root = findHuiRoot();
  const style =
    root && root.shadowRoot && root.shadowRoot.getElementById(STYLE_ID);
  if (style) style.remove();
}

// Lock HA's real scroll container (#view inside hui-root) while a modal sheet is
// open — locking <body> instead would set position:fixed and stop HA's own
// dialogs (children of <home-assistant> inside that body) from laying out. A
// separate style so it's independent of the nav reserve above.
const LOCK_ID = "fibbers-view-lock";
export function lockView(on) {
  const root = findHuiRoot();
  if (!root || !root.shadowRoot) return;
  const existing = root.shadowRoot.getElementById(LOCK_ID);
  if (on) {
    if (existing) return;
    const style = document.createElement("style");
    style.id = LOCK_ID;
    style.textContent = "#view{overflow:hidden !important}";
    root.shadowRoot.appendChild(style);
  } else if (existing) {
    existing.remove();
  }
}

// HA re-renders the view on navigation; debounce like hide-tabs does.
function schedulePaint() {
  if (state.scheduled) return;
  state.scheduled = true;
  setTimeout(() => {
    state.scheduled = false;
    paint();
  }, 60);
}

function startObserver() {
  if (state.observer) return;
  const panel = findResolvedPanel() || document.body;
  try {
    state.observer = new MutationObserver(schedulePaint);
    state.observer.observe(panel, { childList: true, subtree: true });
  } catch (_) {
    /* MutationObserver unavailable — location-changed still re-applies */
  }
}

function stopObserver() {
  if (state.observer) {
    state.observer.disconnect();
    state.observer = null;
  }
}

/** Reserve `px` at the bottom of the view. 0/undefined tears the style down. */
export function setViewReserve(px) {
  const next = Math.max(0, Math.round(px || 0));
  if (next === state.px && state.observer) {
    paint(); // same value, but re-assert (HA may have swapped the view)
    return;
  }
  state.px = next;
  if (!next) {
    removeViewReserve();
    return;
  }
  paint();
  startObserver();
  startNavListeners();
}

/** Full teardown — called from detach() when the last fibbers-nav unmounts. */
export function removeViewReserve() {
  state.px = 0;
  stopObserver();
  stopNavListeners();
  removeStyle();
}

// Re-apply after HA swaps hui-root / rebuilds the view on navigation — bound only
// while a reserve is active, so no work happens on dashboards without a bar.
let navBound = false;
function startNavListeners() {
  if (navBound) return;
  navBound = true;
  window.addEventListener("location-changed", schedulePaint);
  window.addEventListener("popstate", schedulePaint);
}
function stopNavListeners() {
  if (!navBound) return;
  navBound = false;
  window.removeEventListener("location-changed", schedulePaint);
  window.removeEventListener("popstate", schedulePaint);
}
