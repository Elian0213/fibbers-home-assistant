/* ================================================================== *
 * HUI-INJECT — one shared machine for the scoped styles Fibbers writes into
 * hui-root's shadow root (hide-tabs, view-reserve, theme). Each feature subscribes
 * a `(id, computeCss)`; a single MutationObserver on partial-panel-resolver, one
 * 60ms debounce, and one location-changed/popstate pair re-apply all of them on
 * every HA re-render — instead of three observers and three debounces each walking
 * the whole document on their own.
 * ================================================================== */
import { deepFind } from "../shared/util.js";

/**
 * Locate HA's hui-root — the shadow host every scoped style is injected into
 * (verified on HA 2026.8.x). null when the shell hasn't mounted / changed shape.
 * @returns {HTMLElement|null}
 */
export function findHuiRoot() {
  return deepFind("hui-root");
}
const findPanel = () => deepFind("partial-panel-resolver");

const subs = new Map(); // id -> computeCss()
const state = {
  observer: null,
  scheduled: false,
  navBound: false,
  warned: false,
  // true while the observer sits on document.body because partial-panel-resolver
  // hadn't mounted yet — schedule() upgrades it as soon as the panel exists.
  fallback: false,
};

function paintOne(root, id, css) {
  const existing = root.shadowRoot.getElementById(id);
  if (!css) {
    if (existing) existing.remove();
    return;
  }
  if (existing) {
    if (existing.textContent !== css) existing.textContent = css; // idempotent
    return;
  }
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  root.shadowRoot.appendChild(style);
}

function paintAll() {
  const root = findHuiRoot();
  if (!root || !root.shadowRoot) {
    if (!state.warned) {
      state.warned = true;
      console.debug(
        "fibbers: hui-root not found; scoped styles not applied yet",
      );
    }
    return;
  }
  state.warned = false;
  for (const [id, compute] of subs) paintOne(root, id, compute());
}

// A cold load can subscribe before HA mounts partial-panel-resolver, forcing the
// observer onto document.body (whole-document subtree — exactly the cost this
// module exists to avoid). Re-target it onto the panel as soon as it appears.
function retargetIfFallback() {
  if (!state.fallback || !state.observer) return;
  const panel = findPanel();
  if (!panel) return;
  state.observer.disconnect();
  state.observer.observe(panel, { childList: true, subtree: true });
  state.fallback = false;
}

function schedule() {
  if (state.scheduled) return;
  state.scheduled = true;
  setTimeout(() => {
    state.scheduled = false;
    retargetIfFallback();
    paintAll();
  }, 60);
}

function startShared() {
  if (!state.observer && window.MutationObserver) {
    try {
      const panel = findPanel();
      state.fallback = !panel;
      state.observer = new MutationObserver(schedule);
      state.observer.observe(panel || document.body, {
        childList: true,
        subtree: true,
      });
    } catch (_) {
      /* MutationObserver unavailable — the nav listeners still re-apply */
    }
  }
  if (!state.navBound) {
    state.navBound = true;
    window.addEventListener("location-changed", schedule);
    window.addEventListener("popstate", schedule);
  }
}

function stopShared() {
  if (subs.size) return; // other features still subscribed
  if (state.observer) {
    state.observer.disconnect();
    state.observer = null;
    state.fallback = false;
  }
  if (state.navBound) {
    state.navBound = false;
    window.removeEventListener("location-changed", schedule);
    window.removeEventListener("popstate", schedule);
  }
}

/**
 * Subscribe (or update) a scoped style. `computeCss()` returns the CSS to inject
 * into hui-root's shadow root under `id`, or "" / null to remove it; it's called
 * now and on every HA re-render / navigation via the one shared observer.
 * @param {string} id — unique <style> id
 * @param {Function} computeCss — () => string | ""
 */
export function injectStyle(id, computeCss) {
  const first = subs.size === 0;
  subs.set(id, computeCss);
  if (first) startShared();
  paintAll();
}

/**
 * Remove a subscribed style and, once the last feature unsubscribes, tear the
 * shared observer + listeners down so nothing runs on a dashboard without a bar.
 * @param {string} id — the <style> id passed to injectStyle
 */
export function removeStyle(id) {
  subs.delete(id);
  const root = findHuiRoot();
  const existing =
    root && root.shadowRoot && root.shadowRoot.getElementById(id);
  if (existing) existing.remove();
  stopShared();
}

/** Re-apply every subscribed style now (e.g. after a colour-scheme change). */
export function repaint() {
  paintAll();
}
