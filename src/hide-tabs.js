/* ================================================================== *
 * HIDE HA TABS — suppress HA's top tab strip so a bottom-nav dashboard can drop
 * kiosk-mode. It lives inside hui-root's shadow root (verified on HA 2026.8.x),
 * so we inject a <style> there, the way card-mod does.
 * Modes: false = untouched; true = hide ha-tab-group; "header" = hide .header.
 * ================================================================== */

const STYLE_ID = "fibbers-hide-tabs";
const CSS = {
  true: `ha-tab-group { display: none !important; }`,
  header: `.header { display: none !important; }`,
};

const state = {
  mode: false, // false | true | "header"
  observer: null,
  scheduled: false,
};

/** Escape hatches so a stuck dashboard is always recoverable. */
function suppressed() {
  if (window.FIBBERS_SHOW_TABS === true) return true;
  try {
    return new URLSearchParams(window.location.search).has("disable_km");
  } catch (_) {
    return false;
  }
}

/**
 * Walk OPEN shadow roots to find hui-root. Deliberately generic — HA reshuffles
 * the ancestor chain between releases, so we never hard-code it.
 */
export function findHuiRoot() {
  const stack = [document.documentElement];
  while (stack.length) {
    const el = stack.pop();
    if (el.localName === "hui-root") return el;
    if (el.shadowRoot) stack.push(...el.shadowRoot.children);
    if (el.children) stack.push(...el.children);
  }
  return null;
}

/** The panel wrapper we observe for re-renders (best-effort, generic walk). */
function findResolvedPanel() {
  const stack = [document.documentElement];
  while (stack.length) {
    const el = stack.pop();
    if (el.localName === "partial-panel-resolver") return el;
    if (el.shadowRoot) stack.push(...el.shadowRoot.children);
    if (el.children) stack.push(...el.children);
  }
  return null;
}

/** Append or update the single injected style inside hui-root.shadowRoot. */
function paint() {
  if (!state.mode || suppressed()) return removeStyle();
  const root = findHuiRoot();
  if (!root || !root.shadowRoot) {
    console.debug("fibbers: hui-root not found; leaving HA tabs untouched");
    return;
  }
  const css = CSS[state.mode];
  if (!css) return;
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

/** Remove the injected style everywhere it might live. */
function removeStyle() {
  const root = findHuiRoot();
  const style =
    root && root.shadowRoot && root.shadowRoot.getElementById(STYLE_ID);
  if (style) style.remove();
}

/** Debounced re-apply — MutationObserver on the panel fires very often. */
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

/**
 * Set the hiding mode. Called from the bar singleton's attach() with the
 * current config. `false`/undefined tears everything down.
 */
export function setTabHiding(mode) {
  const normalized = mode === true || mode === "header" ? mode : false;
  state.mode = normalized;
  if (!normalized) {
    removeTabHiding();
    return;
  }
  paint();
  startObserver();
}

/**
 * Full teardown — called from detach() when the last fibbers-nav unmounts, so a
 * dashboard with no bar never inherits hidden tabs and becomes unnavigable.
 */
export function removeTabHiding() {
  state.mode = false;
  stopObserver();
  removeStyle();
}

// Re-apply after HA swaps hui-root / rebuilds the toolbar on navigation.
window.addEventListener("location-changed", schedulePaint);
window.addEventListener("popstate", schedulePaint);
