/* ================================================================== *
 * VIEW RESERVE — keep the pinned bottom bar from covering the last card.
 *
 * The old approach was an in-flow spacer inside the nav card, but on a multi-column
 * Sections view a spacer only adds height to *its own* column. Instead we reserve on
 * the view itself: padding-bottom on hui-root's scroll container (#view), injected
 * through the shared hui-inject machine, so it clears every column at once. Removed
 * when the last nav card detaches.
 * ================================================================== */
import { injectStyle, removeStyle } from "./hui-inject.js";

const STYLE_ID = "fibbers-view-reserve";

const state = { px: 0 };

function computeCss() {
  // #view is hui-root's scroll/content container; padding-bottom there sits below
  // the whole sections grid, so it clears all columns uniformly.
  return state.px ? `#view { padding-bottom: ${state.px}px !important; }` : "";
}

const LOCK_ID = "fibbers-view-lock";
/**
 * Freeze/unfreeze HA's real scroll container (#view) while a modal sheet is open.
 * Locks #view — not <body> — so HA's own dialogs (children of <home-assistant>)
 * still lay out. Routed through the shared injector so a lock requested before
 * hui-root resolves still lands (and survives HA re-renders) instead of silently
 * never applying for the life of the sheet.
 * @param {boolean} on — true to lock, false to release
 */
export function lockView(on) {
  if (on) injectStyle(LOCK_ID, () => "#view{overflow:hidden !important}");
  else removeStyle(LOCK_ID);
}

/**
 * Reserve `px` at the bottom of the view so the pinned bar can't cover the last
 * card. 0/undefined tears the style down. The shared observer re-asserts it after
 * HA swaps the view.
 * @param {number} px
 */
export function setViewReserve(px) {
  state.px = Math.max(0, Math.round(px || 0));
  if (!state.px) {
    removeViewReserve();
    return;
  }
  injectStyle(STYLE_ID, computeCss);
}

/** Drop the reserve. Called from detach() when the last fibbers-nav unmounts. */
export function removeViewReserve() {
  state.px = 0;
  removeStyle(STYLE_ID);
}
