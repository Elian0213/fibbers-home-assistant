/* ================================================================== *
 * THEME-HOST — reflect Home Assistant's light/dark mode onto a card host.
 *
 * Cards paint from `--color-*` tokens (see styles/tailwind.css). The dark palette
 * is the default; the light palette is gated behind `:host([data-fib-theme="light"])`.
 * This module flips that attribute from `hass.themes.darkMode` — HA's authoritative
 * light/dark signal — so every Fibbers card auto-follows the user's theme with no
 * config. That "works for everyone" behaviour is what HACS-default inclusion needs.
 * ================================================================== */
import type { ReactiveController, ReactiveControllerHost } from "lit";

// `custom-card-helpers`' `Themes` type omits `darkMode`, so widen locally rather
// than casting at every call site.
interface HassLike {
  themes?: { darkMode?: boolean };
}

/**
 * Reflect the current HA light/dark mode onto a shadow host as
 * `data-fib-theme="light" | "dark"`. Missing hass or a truthy `darkMode` → dark
 * (the pre-existing default, so nothing flashes before hass arrives); an explicit
 * `darkMode === false` → light.
 * @param host — the element whose host attribute to set (a card, the nav bar, the sheet)
 * @param hass — the Home Assistant object (or anything carrying `themes.darkMode`)
 */
export function reflectTheme(host: HTMLElement, hass: unknown): void {
  const dark = (hass as HassLike | null | undefined)?.themes?.darkMode;
  const value = dark === false ? "light" : "dark";
  // Guard so this is cheap to call from a `set hass` that fires on every state
  // push — a same-value write is a no-op but we skip the mutation entirely.
  if (host.getAttribute("data-fib-theme") !== value)
    host.setAttribute("data-fib-theme", value);
}

/**
 * A Lit `ReactiveController` that keeps `data-fib-theme` in sync with
 * `host.hass.themes.darkMode`. Drop one line into a card —
 * `private _theme = new ThemeController(this);` — and the whole shadow subtree
 * recolours whenever the HA theme flips, with no extra render.
 */
export class ThemeController implements ReactiveController {
  constructor(
    private host: ReactiveControllerHost & HTMLElement & { hass?: unknown },
  ) {
    host.addController(this);
  }

  /** Paint the theme attribute before the first render to avoid a flash. */
  hostConnected(): void {
    reflectTheme(this.host, this.host.hass);
  }

  /** Re-reflect after every update, when `hass` is current. */
  hostUpdated(): void {
    reflectTheme(this.host, this.host.hass);
  }
}
