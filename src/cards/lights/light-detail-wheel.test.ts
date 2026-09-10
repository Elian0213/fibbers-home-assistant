/* Unit tests for the derived colour-cluster logic — same-colour lamps merge into
 * one unit, different colours stay apart, warm lamps cluster by kelvin, and a solo
 * peel splits one lamp back out. Driven through a mock host + hass (no DOM). */
import { describe, expect, test } from "bun:test";

import type { HomeAssistant } from "@/types/home-assistant";

import { WheelController, type WheelHost } from "./light-detail-wheel";

const colour = (hs: [number, number]) => ({
  state: "on",
  attributes: { supported_color_modes: ["hs"], hs_color: hs },
});
const warm = (k: number) => ({
  state: "on",
  attributes: { supported_color_modes: ["color_temp"], color_temp_kelvin: k },
});

const hass = {
  states: {
    "light.a": colour([210, 80]),
    "light.b": colour([210, 80]), // same as a
    "light.c": colour([30, 80]), // different hue
    "light.w1": warm(2700),
    "light.w2": warm(2750), // within GROUP_K of w1
    "light.w3": warm(3400), // far from w1/w2
  },
} as unknown as HomeAssistant;

function mkController(lamps: string[]): {
  wheel: WheelController;
  host: { active: string };
} {
  let active = lamps[0];
  const host: WheelHost = {
    hass,
    lamps: () => lamps,
    get active() {
      return active;
    },
    selectActive(id: string) {
      active = id;
    },
    call() {},
    addController() {},
    removeController() {},
    requestUpdate() {},
    updateComplete: Promise.resolve(true),
  };
  return { wheel: new WheelController(host), host };
}

describe("derived colour clusters", () => {
  test("same-colour colour lamps form one unit; a different hue is its own", () => {
    const { wheel } = mkController(["light.a", "light.b", "light.c"]);
    const units = wheel.units();
    expect(units.length).toBe(2);
    const ab = units.find((u) => u.members.includes("light.a"))!;
    expect(new Set(ab.members)).toEqual(new Set(["light.a", "light.b"]));
    expect(wheel.membersOf("light.b")).toContain("light.a");
    expect(wheel.groupCount("light.a")).toBe(2);
    expect(wheel.groupCount("light.c")).toBe(1);
  });

  test("warm lamps cluster by kelvin proximity", () => {
    const { wheel } = mkController(["light.w1", "light.w2", "light.w3"]);
    const units = wheel.units();
    expect(units.length).toBe(2);
    const near = units.find((u) => u.members.includes("light.w1"))!;
    expect(new Set(near.members)).toEqual(new Set(["light.w1", "light.w2"]));
    expect(near.warm).toBe(true);
    expect(wheel.membersOf("light.w3")).toEqual(["light.w3"]);
  });

  test("colour and warm lamps never share a unit", () => {
    const { wheel } = mkController(["light.a", "light.w1"]);
    expect(wheel.units().length).toBe(2);
  });

  test("re-tapping the focused lamp peels it; tapping again rejoins", () => {
    const { wheel, host } = mkController(["light.a", "light.b"]);
    expect(wheel.units().length).toBe(1); // a & b clustered, a focused
    wheel.focusOrSolo("light.a"); // re-tap the focused lamp → peel
    expect(host.active).toBe("light.a");
    expect(wheel.units().length).toBe(2);
    expect(wheel.membersOf("light.a")).toEqual(["light.a"]);
    wheel.focusOrSolo("light.a"); // re-tap again → rejoin
    expect(wheel.units().length).toBe(1);
  });

  test("focusing a different lamp controls its whole colour-group", () => {
    const { wheel, host } = mkController(["light.a", "light.b"]);
    wheel.focusOrSolo("light.a"); // peel a
    expect(wheel.units().length).toBe(2);
    wheel.focusOrSolo("light.b"); // focus b → clears the solo peel
    expect(host.active).toBe("light.b");
    expect(wheel.units().length).toBe(1);
    expect(new Set(wheel.membersOf("light.b"))).toEqual(
      new Set(["light.a", "light.b"]),
    );
  });

  test("reset on a new room signature drops the solo peel", () => {
    const { wheel } = mkController(["light.a", "light.b"]);
    wheel.focusOrSolo("light.a"); // active is a → peel
    expect(wheel.units().length).toBe(2);
    wheel.reset("a-different-room");
    expect(wheel.units().length).toBe(1); // re-clustered
  });
});
