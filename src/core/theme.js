/* ================================================================== *
 * THEME — the per-dashboard palette, opt-in via `theme:` on fibbers-nav.
 *
 * Unlike the old global CSS (which repainted all of Home Assistant on load),
 * this is scoped: it injects HA's theme vars into hui-root's shadow root — the
 * same place hide-tabs writes — so only the mounted Fibbers dashboard is themed,
 * and it's removed the moment the last nav card detaches. Other dashboards, the
 * sidebar and the header keep the user's own theme.
 *
 *   theme: none                 (default) — inject nothing
 *   theme: fibbers              — the dark forest-green palette (dashboard only)
 *   theme: fibbers-light        — a light palette derived for legibility (dashboard only)
 *   theme: auto                 — follow prefers-color-scheme (dashboard only)
 *   theme: fibbers-global       — the dark palette across ALL of Home Assistant
 *                                 (sidebar, header, Settings, dialogs) via <html>
 *   theme: fibbers-global-light — the light palette across all of Home Assistant
 * ================================================================== */
import { DARK_VARS, setGlobalVars, clearGlobalVars } from "./global-css.js";
import { injectStyle, removeStyle } from "./hui-inject.js";

const STYLE_ID = "fibbers-theme";

// Light palette. Derived for contrast on light surfaces rather than inverted: a
// deeper green accent (readable on white), dark ink on near-white grounds, softer
// dividers. Amber/red are darkened so warnings stay legible on light.
const LIGHT_VARS = {
  // grounds & surfaces
  "--primary-background-color": "#EEF1F0",
  "--secondary-background-color": "#FFFFFF",
  "--card-background-color": "#FFFFFF",
  "--ha-card-background": "#FFFFFF",
  "--app-header-background-color": "#FFFFFF",
  "--app-header-text-color": "#14201A",
  "--sidebar-background-color": "#FFFFFF",
  "--sidebar-icon-color": "#5C6A6D",
  "--sidebar-text-color": "#3A4744",
  "--sidebar-selected-icon-color": "#2F6B45",
  "--sidebar-selected-text-color": "#14201A",
  "--divider-color": "#E1E5E3",
  // text
  "--primary-text-color": "#14201A",
  "--secondary-text-color": "#55635C",
  "--disabled-text-color": "#9AA5A0",
  "--text-primary-color": "#FFFFFF",
  // accent (green); amber is reserved for --warning-color
  "--primary-color": "#2F6B45",
  "--accent-color": "#2F6B45",
  "--state-icon-color": "#55635C",
  "--state-icon-active-color": "#2F6B45",
  "--error-color": "#C4443B",
  "--warning-color": "#B7791F",
  "--success-color": "#2F6B45",
  "--info-color": "#2F6FB0",
  // cards
  "--ha-card-border-radius": "15px",
  "--ha-card-border-width": "1px",
  "--ha-card-border-color": "#E1E5E3",
  "--ha-card-box-shadow": "none",
  // dialogs
  "--ha-dialog-border-radius": "22px",
  "--mdc-dialog-scrim-color": "rgba(20,32,26,.32)",
  "--mdc-theme-surface": "#FFFFFF",
  "--ha-dialog-surface-background": "#FFFFFF",
  "--more-info-header-background": "#FFFFFF",
  "--dialog-backdrop-filter": "blur(3px)",
  // controls
  "--switch-checked-color": "#2F6B45",
  "--switch-checked-button-color": "#FFFFFF",
  "--switch-checked-track-color": "#A9CDB6",
  "--switch-unchecked-button-color": "#FFFFFF",
  "--switch-unchecked-track-color": "#C7CDCA",
  "--paper-slider-active-color": "#2F6B45",
  "--paper-slider-knob-color": "#2F6B45",
  "--paper-slider-container-color": "#D8DDDA",
};

const state = { mode: "none", mql: null };

// Which palette the current mode resolves to (null = inject nothing).
function palette() {
  if (state.mode === "fibbers") return DARK_VARS;
  if (state.mode === "fibbers-light") return LIGHT_VARS;
  if (state.mode === "auto") {
    const dark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    return dark ? DARK_VARS : LIGHT_VARS;
  }
  return null;
}

// The sidebar and HA's dialogs (more-info, the scrim) render outside hui-root, so
// vars scoped to hui-root's :host can never reach them — drop them here (they stay
// in the source objects for the global-css path, which sets them on <html>).
const unreachable = (k) =>
  k.startsWith("--sidebar-") ||
  /dialog/.test(k) ||
  k === "--mdc-theme-surface" ||
  k === "--more-info-header-background";

// Scope the vars to hui-root's shadow host: closer than HA's own theme root, so
// they win for the dashboard subtree without !important and without leaking out.
function cssFor(vars) {
  const decls = Object.entries(vars)
    .filter(([k]) => !unreachable(k))
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `:host {\n${decls}\n}`;
}

// The style the shared injector re-applies on every HA re-render ("" → removed).
function computeCss() {
  const vars = palette();
  return vars ? cssFor(vars) : "";
}

const onScheme = () => {
  // In `auto`, a colour-scheme flip changes which palette computeCss() returns.
  if (state.mode === "auto") injectStyle(STYLE_ID, computeCss);
};

function watchScheme() {
  if (state.mql || !window.matchMedia) return;
  state.mql = window.matchMedia("(prefers-color-scheme: dark)");
  try {
    state.mql.addEventListener("change", onScheme);
  } catch (_) {
    state.mql.addListener(onScheme); // older Safari
  }
}

function unwatchScheme() {
  if (!state.mql) return;
  try {
    state.mql.removeEventListener("change", onScheme);
  } catch (_) {
    state.mql.removeListener(onScheme);
  }
  state.mql = null;
}

/**
 * Apply the theme from the bar singleton's attach(). Dashboard modes inject the
 * palette into hui-root's shadow root (scoped); the `-global` modes set it on
 * <html> so all of Home Assistant is themed. `none`/undefined tears everything down.
 * @param {"fibbers"|"fibbers-light"|"auto"|"fibbers-global"|"fibbers-global-light"|"none"} mode
 */
export function applyTheme(mode) {
  const KNOWN = [
    "fibbers",
    "fibbers-light",
    "auto",
    "fibbers-global",
    "fibbers-global-light",
  ];
  const normalized = KNOWN.includes(mode) ? mode : "none";
  state.mode = normalized;
  if (normalized === "none") {
    removeTheme();
    return;
  }
  if (
    normalized === "fibbers-global" ||
    normalized === "fibbers-global-light"
  ) {
    // Whole-HA takeover: the <html> palette (with !important) covers the dashboard
    // too, so drop the scoped style and the scheme watcher.
    removeStyle(STYLE_ID);
    unwatchScheme();
    setGlobalVars(
      normalized === "fibbers-global-light" ? LIGHT_VARS : DARK_VARS,
    );
    return;
  }
  // Scoped dashboard theme.
  clearGlobalVars();
  injectStyle(STYLE_ID, computeCss);
  if (normalized === "auto") watchScheme();
  else unwatchScheme();
}

/**
 * Full teardown — drop the scoped style, the global palette, and the scheme
 * watcher. Called from detach() when the last fibbers-nav unmounts.
 */
export function removeTheme() {
  state.mode = "none";
  unwatchScheme();
  removeStyle(STYLE_ID);
  clearGlobalVars();
}
