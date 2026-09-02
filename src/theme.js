/* ================================================================== *
 * THEME — the per-dashboard palette, opt-in via `theme:` on fibbers-nav.
 *
 * Unlike the old global CSS (which repainted all of Home Assistant on load),
 * this is scoped: it injects HA's theme vars into hui-root's shadow root — the
 * same place hide-tabs writes — so only the mounted Fibbers dashboard is themed,
 * and it's removed the moment the last nav card detaches. Other dashboards, the
 * sidebar and the header keep the user's own theme.
 *
 *   theme: none           (default) — inject nothing
 *   theme: fibbers        — the dark forest-green palette (as shipped)
 *   theme: fibbers-light  — a light palette derived for legibility (not inverted)
 *   theme: auto           — follow prefers-color-scheme
 * ================================================================== */
import { DARK_VARS } from "./global-css.js";
import { deepFind } from "./util.js";

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

const state = { mode: "none", scheduled: false, observer: null, mql: null };

const findHuiRoot = () => deepFind("hui-root");
const findResolvedPanel = () => deepFind("partial-panel-resolver");

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

function paint() {
  const vars = palette();
  if (!vars) return removeStyle();
  const root = findHuiRoot();
  if (!root || !root.shadowRoot) return;
  const css = cssFor(vars);
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

// HA re-renders the panel often; debounce like hide-tabs does.
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

const onScheme = () => {
  if (state.mode === "auto") schedulePaint();
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
 * Apply the dashboard theme. Called from the bar singleton's attach() with the
 * nav config. `none`/undefined tears the injected style down.
 */
export function applyTheme(mode) {
  const normalized = ["fibbers", "fibbers-light", "auto"].includes(mode)
    ? mode
    : "none";
  state.mode = normalized;
  if (normalized === "none") {
    removeTheme();
    return;
  }
  paint();
  startObserver();
  startNavListeners();
  if (normalized === "auto") watchScheme();
  else unwatchScheme();
}

/** Full teardown — called from detach() when the last fibbers-nav unmounts. */
export function removeTheme() {
  state.mode = "none";
  stopObserver();
  stopNavListeners();
  unwatchScheme();
  removeStyle();
}

// Re-apply after HA swaps hui-root / rebuilds the view on navigation — but only
// bind these while a theme is actually active, so a dashboard with `theme: none`
// (the default) doesn't run a repaint on every navigation.
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
