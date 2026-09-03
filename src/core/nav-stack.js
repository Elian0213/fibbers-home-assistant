/* ================================================================== *
 * NAVIGATION STACK — a real "where did I come from" stack (HA has none), so a
 * back control returns to the previous view. Switching tabs resets it (tabs are roots).
 * ================================================================== */
import { store, norm, here, navigate } from "../shared/util.js";

const NAV_KEY = "fibbers:navstack";

/**
 * The shared nav state — the set of tab (root) paths, the persisted history
 * stack, route-change listeners, and a live hass reference for badge/inset checks.
 */
export const nav = {
  tabs: new Set(),
  stack: store.get(NAV_KEY, []),
  listeners: new Set(),
  hassRef: null,
};

/**
 * Register tab paths as stack roots so navigating to one resets the back stack.
 * @param {string[]} paths
 */
export const registerTabs = (paths) =>
  paths.forEach((p) => nav.tabs.add(norm(p)));

/**
 * True if `path` is a registered tab root (and so should reset the stack).
 * @param {string} path
 * @returns {boolean}
 */
export const isTab = (path) => nav.tabs.has(norm(path));

/**
 * Fold the current route into the stack — reset at a tab, pop on back-navigation,
 * else push — then persist (capped) and fire listeners. Wired to HA's route
 * events; a throwing listener can't stop the rest.
 */
export function onRouteChange() {
  const path = here();
  const s = nav.stack;

  if (isTab(path)) {
    nav.stack = [path];
  } else if (s.length >= 2 && norm(s[s.length - 2]) === path) {
    nav.stack = s.slice(0, -1);
  } else if (norm(s[s.length - 1]) !== path) {
    nav.stack = s.concat([path]);
  }

  if (nav.stack.length > 20) nav.stack = nav.stack.slice(-20); // cap depth
  store.set(NAV_KEY, nav.stack);
  nav.listeners.forEach((fn) => {
    try {
      fn();
    } catch (_) {
      /* a throwing listener must not stop the others */
    }
  });
}

/**
 * The path a back control would return to, or null if there's nowhere to go back.
 * @returns {string|null}
 */
export const previous = () =>
  nav.stack.length >= 2 ? nav.stack[nav.stack.length - 2] : null;

/**
 * Navigate back — to the previous stacked view, else to `fallback`, else HA's
 * browser history. Pops the stack when it drives the navigation itself.
 * @param {string} [fallback] — path to use when the stack has no previous entry
 */
export function goBack(fallback) {
  const prev = previous();
  if (prev) {
    nav.stack = nav.stack.slice(0, -1);
    store.set(NAV_KEY, nav.stack);
    navigate(prev);
    return;
  }
  if (fallback) {
    navigate(fallback);
    return;
  }
  if (history.length > 1) history.back();
}

// Route tracking runs only while a nav bar or back control is mounted (ref-counted),
// not merely because the HACS resource is loaded — otherwise every HA page (Settings,
// Developer Tools) would fold its path onto the back stack, and a `fibbers-back` card
// could then send the user into Settings.
let navOn = 0;

/** Begin folding route changes into the back stack (ref-counted; idempotent). */
export function startNav() {
  if (navOn++ > 0) return;
  window.addEventListener("location-changed", onRouteChange);
  window.addEventListener("popstate", onRouteChange);
  onRouteChange();
}

/** Stop route tracking when the last consumer unmounts. */
export function stopNav() {
  if (navOn === 0 || --navOn > 0) return;
  window.removeEventListener("location-changed", onRouteChange);
  window.removeEventListener("popstate", onRouteChange);
}
