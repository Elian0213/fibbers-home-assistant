/* ================================================================== *
 * NAVIGATION STACK
 *
 * Default HA has no notion of "where did I come from" — a subview's back arrow
 * always returns to the dashboard root. This keeps a real stack, so a back
 * control returns to the view you actually came from, while switching tabs
 * resets it (tabs are roots, not history).
 * ================================================================== */
import { store, norm, here, navigate } from "./util.js";

const NAV_KEY = "fibbers:navstack";

export const nav = {
  tabs: new Set(),
  stack: store.get(NAV_KEY, []),
  listeners: new Set(),
  hassRef: null,
};

export const registerTabs = (paths) =>
  paths.forEach((p) => nav.tabs.add(norm(p)));
export const isTab = (path) => nav.tabs.has(norm(path));

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

  if (nav.stack.length > 20) nav.stack = nav.stack.slice(-20);
  store.set(NAV_KEY, nav.stack);
  nav.listeners.forEach((fn) => {
    try {
      fn();
    } catch (_) {}
  });
}

/** Where a back control would go, or null if there is nowhere to return to. */
export const previous = () =>
  nav.stack.length >= 2 ? nav.stack[nav.stack.length - 2] : null;

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

window.addEventListener("location-changed", onRouteChange);
window.addEventListener("popstate", onRouteChange);
onRouteChange();
