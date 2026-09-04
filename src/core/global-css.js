/* ================================================================== *
 * GLOBAL CSS — the "restyle all of Home Assistant" route, kept as an opt-in.
 * Sets HA's theme vars on <html> with !important; they inherit into shadow DOM,
 * so more-info dialogs match too. Mirrors docs/optional-theme.yaml.
 *
 * As of 0.6.0 this is NOT called on load (installing Fibbers no longer repaints
 * the whole UI). The dark palette (`DARK_VARS`) is reused by src/theme.js for the
 * per-dashboard `theme:` option. Anyone who wants the old global behaviour can
 * still call `window.FIBBERS.injectGlobalCss()`; the escape hatch
 * `window.FIBBERS_DISABLE_GLOBAL_CSS = true` continues to work.
 * ================================================================== */
import { T } from "../shared/tokens.js";

const STYLE_ID = "fibbers-global";

/**
 * The dark forest-green palette as HA theme-var declarations. Shared surface —
 * global-css sets these on <html>; theme.js reuses the same object scoped to one
 * dashboard's hui-root.
 */
export const DARK_VARS = {
  // grounds & surfaces
  "--primary-background-color": T.bg,
  "--secondary-background-color": T.nav,
  "--card-background-color": T.card,
  "--ha-card-background": T.card,
  "--app-header-background-color": T.bg,
  "--app-header-text-color": T.ink,
  "--sidebar-background-color": "#0E1315",
  "--sidebar-icon-color": T.muted,
  "--sidebar-text-color": T.ink2,
  "--sidebar-selected-icon-color": T.accent,
  "--sidebar-selected-text-color": T.ink,
  "--divider-color": T.line,
  // text
  "--primary-text-color": T.ink,
  "--secondary-text-color": "#8B999C",
  "--disabled-text-color": "#5C6A6D",
  "--text-primary-color": T.bg,
  // accent (green); amber is reserved for --warning-color
  "--primary-color": T.accent,
  "--accent-color": T.accent,
  "--state-icon-color": "#8B999C",
  "--state-icon-active-color": T.accent,
  "--error-color": T.red,
  "--warning-color": T.amber,
  "--success-color": T.green,
  "--info-color": T.blue,
  // cards
  "--ha-card-border-radius": "15px",
  "--ha-card-border-width": "1px",
  "--ha-card-border-color": T.line,
  "--ha-card-box-shadow": "none",
  // dialogs (the more-info sheet you get tapping a light)
  "--ha-dialog-border-radius": "22px",
  "--mdc-dialog-scrim-color": "rgba(6,9,10,.72)",
  "--mdc-theme-surface": T.sheet,
  "--ha-dialog-surface-background": T.sheet,
  "--more-info-header-background": T.sheet,
  "--dialog-backdrop-filter": "blur(3px)",
  // controls
  "--switch-checked-color": T.accent,
  "--switch-checked-button-color": T.ink,
  "--switch-checked-track-color": "#2E5238",
  "--switch-unchecked-button-color": "#8B999C",
  "--switch-unchecked-track-color": T.line,
  "--paper-slider-active-color": T.accent,
  "--paper-slider-knob-color": T.accent,
  "--paper-slider-container-color": "#2C3639",
};

/**
 * Set a palette on <html> with !important so it inherits into every shadow root —
 * HA's sidebar, header, Settings, and the more-info dialogs all pick it up. Replaces
 * any previous global palette (so switching dark↔light is clean). Skipped when
 * `FIBBERS_DISABLE_GLOBAL_CSS` is set.
 * @param {object} [vars] — HA theme-var map (defaults to the dark palette)
 */
export function setGlobalVars(vars = DARK_VARS) {
  if (window.FIBBERS_DISABLE_GLOBAL_CSS) return;
  const decls = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v} !important;`)
    .join("\n");
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `html {\n${decls}\n}`;
}

/** Remove the global palette, restoring HA's own theme everywhere. */
export function clearGlobalVars() {
  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
}

/**
 * Back-compatible opt-in "repaint all of Home Assistant" — the dark palette on
 * <html>. Still exposed on `window.FIBBERS.injectGlobalCss()`; the nav's
 * `theme: fibbers-global` uses `setGlobalVars` directly.
 */
export function injectGlobalCss() {
  setGlobalVars(DARK_VARS);
}
