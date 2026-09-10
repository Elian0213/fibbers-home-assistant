/* Unit tests for the light/dark theme reflection — mapping `hass.themes.darkMode`
 * onto the host's `data-fib-theme` attribute. No DOM needed: a tiny attribute stub
 * stands in for the host element. */
import { describe, expect, test } from "bun:test";

import { reflectTheme, ThemeController } from "./theme-host";

/** Minimal HTMLElement stand-in: just the attribute API reflectTheme touches. */
function makeHost(hass?: unknown) {
  const attrs: Record<string, string> = {};
  return {
    hass,
    controllers: [] as unknown[],
    addController(c: unknown) {
      this.controllers.push(c);
    },
    getAttribute(k: string): string | null {
      return k in attrs ? attrs[k] : null;
    },
    setAttribute(k: string, v: string) {
      attrs[k] = v;
    },
  };
}

describe("reflectTheme", () => {
  test("no hass → dark (the safe default before hass arrives)", () => {
    const host = makeHost(undefined);
    reflectTheme(host as unknown as HTMLElement, host.hass);
    expect(host.getAttribute("data-fib-theme")).toBe("dark");
  });

  test("darkMode true → dark", () => {
    const host = makeHost({ themes: { darkMode: true } });
    reflectTheme(host as unknown as HTMLElement, host.hass);
    expect(host.getAttribute("data-fib-theme")).toBe("dark");
  });

  test("darkMode false → light", () => {
    const host = makeHost({ themes: { darkMode: false } });
    reflectTheme(host as unknown as HTMLElement, host.hass);
    expect(host.getAttribute("data-fib-theme")).toBe("light");
  });

  test("darkMode undefined → dark", () => {
    const host = makeHost({ themes: {} });
    reflectTheme(host as unknown as HTMLElement, host.hass);
    expect(host.getAttribute("data-fib-theme")).toBe("dark");
  });
});

describe("ThemeController", () => {
  test("registers itself on the host", () => {
    const host = makeHost();
    const controller = new ThemeController(host as never);
    expect(host.controllers).toContain(controller);
  });

  test("hostConnected then hostUpdated track the current hass", () => {
    const host = makeHost({ themes: { darkMode: false } });
    const controller = new ThemeController(host as never);

    controller.hostConnected();
    expect(host.getAttribute("data-fib-theme")).toBe("light");

    host.hass = { themes: { darkMode: true } };
    controller.hostUpdated();
    expect(host.getAttribute("data-fib-theme")).toBe("dark");
  });
});
