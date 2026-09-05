/* ================================================================== *
 * NAVIGATION STACK — a real "where did I come from" stack (HA has none), so a
 * back control returns to the previous view. Switching tabs resets it (tabs are roots).
 * ================================================================== */
import { store, norm, here, navigate } from "@shared/util";
import type { HomeAssistant } from "@/types/home-assistant";

const NAV_KEY = "fibbers:navstack";

/** The shared, mutable nav state consumed across the core modules. */
export interface NavState {
  /** Tab (root) paths — navigating to one resets the back stack. */
  tabs: Set<string>;
  /** The persisted history stack (most recent last). */
  stack: string[];
  /** Route-change listeners fired after every fold. */
  listeners: Set<() => void>;
  /** Live hass reference for badge/inset checks; null until the nav sets it. */
  hassRef: HomeAssistant | null;
}

/**
 * The shared nav state — the set of tab (root) paths, the persisted history
 * stack, route-change listeners, and a live hass reference for badge/inset checks.
 */
export const nav: NavState = {
  tabs: new Set<string>(),
  stack: store.get(NAV_KEY, []),
  listeners: new Set<() => void>(),
  hassRef: null,
};

/**
 * Register tab paths as stack roots so navigating to one resets the back stack.
 * @param paths — the tab root paths to register
 */
export const registerTabs = (paths: string[]): void => {
  paths.forEach((p) => nav.tabs.add(norm(p)));
};

/**
 * True if `path` is a registered tab root (and so should reset the stack).
 * @param path — the normalised-or-raw path to test
 * @returns whether `path` is a registered tab root
 */
export const isTab = (path: string): boolean => nav.tabs.has(norm(path));

/**
 * Fold the current route into the stack — reset at a tab, pop on back-navigation,
 * else push — then persist (capped) and fire listeners. Wired to HA's route
 * events; a throwing listener can't stop the rest.
 */
export function onRouteChange(): void {
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
 * @returns the previous stacked path, or null
 */
export const previous = (): string | null =>
  nav.stack.length >= 2 ? nav.stack[nav.stack.length - 2] : null;

/**
 * Navigate back — to the previous stacked view, else to `fallback`, else HA's
 * browser history. Pops the stack when it drives the navigation itself.
 * @param fallback — path to use when the stack has no previous entry
 */
export function goBack(fallback?: string): void {
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
  if (window.history.length > 1) window.history.back();
}

// Route tracking runs only while a nav bar or back control is mounted (ref-counted),
// not merely because the HACS resource is loaded — otherwise every HA page (Settings,
// Developer Tools) would fold its path onto the back stack, and a `fibbers-back` card
// could then send the user into Settings.
let navOn = 0;

/** Begin folding route changes into the back stack (ref-counted; idempotent). */
export function startNav(): void {
  if (navOn++ > 0) return;
  window.addEventListener("location-changed", onRouteChange);
  window.addEventListener("popstate", onRouteChange);
  onRouteChange();
}

/** Stop route tracking when the last consumer unmounts. */
export function stopNav(): void {
  if (navOn === 0 || --navOn > 0) return;
  window.removeEventListener("location-changed", onRouteChange);
  window.removeEventListener("popstate", onRouteChange);
}
