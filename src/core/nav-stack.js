/* ================================================================== *
 * NAVIGATION STACK — a real "where did I come from" stack (HA has none), so a
 * back control returns to the previous view. Switching tabs resets it (tabs are roots).
 * ================================================================== */
import { store, norm, here, navigate } from "../shared/util.js";

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
