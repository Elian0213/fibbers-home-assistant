/* Unit tests for the control-panel slider value math over a mock hass. */
import { describe, expect, test } from "bun:test";

import type { HomeAssistant } from "@/types/home-assistant";

import {
  ctlBounds,
  ctlRawValue,
  ctlSnap,
  ctlPct,
  ctlValFromX,
} from "./ctl-math";

const hass = {
  states: {
    "light.lamp": { state: "on", attributes: { brightness: 128 } },
    "light.off": { state: "off", attributes: {} },
    "number.sharpness": {
      state: "7",
      attributes: { min: 0, max: 20, step: 0.5 },
    },
    "number.bare": { state: "3", attributes: {} },
    "number.bad": { state: "notanumber", attributes: { min: 2, max: 8 } },
    "number.inverted": { state: "0", attributes: { min: 5, max: 5 } },
  },
} as unknown as HomeAssistant;

describe("ctlBounds", () => {
  test("a light is always 0–100 step 1", () => {
    expect(ctlBounds(hass, "light.lamp")).toEqual({
      min: 0,
      max: 100,
      step: 1,
    });
  });

  test("a number uses its own min/max/step", () => {
    expect(ctlBounds(hass, "number.sharpness")).toEqual({
      min: 0,
      max: 20,
      step: 0.5,
    });
  });

  test("missing attrs default to 0/100/1", () => {
    expect(ctlBounds(hass, "number.bare")).toEqual({
      min: 0,
      max: 100,
      step: 1,
    });
  });

  test("max <= min is nudged to min + 1", () => {
    expect(ctlBounds(hass, "number.inverted")).toEqual({
      min: 5,
      max: 6,
      step: 1,
    });
  });
});

describe("ctlRawValue", () => {
  test("light → brightness percent (128/255 ≈ 50)", () => {
    expect(ctlRawValue(hass, "light.lamp")).toBe(50);
  });

  test("light off → 0", () => {
    expect(ctlRawValue(hass, "light.off")).toBe(0);
  });

  test("number → its numeric state", () => {
    expect(ctlRawValue(hass, "number.sharpness")).toBe(7);
  });

  test("non-numeric number state → the min bound", () => {
    expect(ctlRawValue(hass, "number.bad")).toBe(2);
  });
});

describe("ctlSnap", () => {
  test("rounds to the step and clamps into range", () => {
    expect(ctlSnap(hass, "number.sharpness", 7.3)).toBe(7.5);
    expect(ctlSnap(hass, "number.sharpness", -4)).toBe(0);
    expect(ctlSnap(hass, "number.sharpness", 999)).toBe(20);
  });

  test("float artefacts are trimmed (toFixed 4)", () => {
    // 0.1 + 0.2 style drift must not leak into the snapped value.
    expect(ctlSnap(hass, "number.sharpness", 0.30000000000000004)).toBe(0.5);
  });
});

describe("ctlPct", () => {
  test("value → 0–100 percent of range", () => {
    expect(ctlPct(hass, "number.sharpness", 10)).toBe(50);
    expect(ctlPct(hass, "light.lamp", 25)).toBe(25);
  });
});

describe("ctlValFromX", () => {
  // A fake track element: pctFromX only reads getBoundingClientRect().
  const track = {
    getBoundingClientRect: () => ({ left: 0, width: 200 }),
  } as unknown as Element;

  test("maps pointer x to a snapped value in range", () => {
    // Halfway along a 200px track over a 0–20 range → 10.
    expect(ctlValFromX(hass, "number.sharpness", 100, track)).toBe(10);
    // Past the right edge clamps to max.
    expect(ctlValFromX(hass, "number.sharpness", 260, track)).toBe(20);
  });
});
