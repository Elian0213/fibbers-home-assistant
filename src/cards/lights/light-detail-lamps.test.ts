/* Unit tests for the pure lamp accessors — state/attribute reads and derived
 * swatch colour over a mock hass. */
import { describe, expect, test } from "bun:test";

import type { HomeAssistant } from "@/types/home-assistant";

import { STRIP_LO, STRIP_HI } from "./light-detail-math";
import {
  lampState,
  lampOn,
  lampUnavail,
  lampAttr,
  lampModes,
  lampHasColor,
  lampHasTemp,
  lampHs,
  lampKRange,
  lampKelvin,
  swatchColor,
} from "./light-detail-lamps";

const hass = {
  states: {
    "light.colour": {
      state: "on",
      attributes: {
        supported_color_modes: ["hs", "color_temp"],
        hs_color: [210, 80],
        rgb_color: [40, 120, 255],
        color_temp_kelvin: 3000,
        min_color_temp_kelvin: 2200,
        max_color_temp_kelvin: 6000,
        friendly_name: "Colour lamp",
      },
    },
    "light.warm": {
      state: "on",
      attributes: {
        supported_color_modes: ["color_temp"],
        color_temp_kelvin: 2700,
      },
    },
    "light.plain_on": {
      state: "on",
      attributes: { supported_color_modes: ["onoff"] },
    },
    "light.off": { state: "off", attributes: {} },
    "light.gone": { state: "unavailable", attributes: {} },
  },
} as unknown as HomeAssistant;

describe("state reads", () => {
  test("lampState / lampOn / lampUnavail", () => {
    expect(lampState(hass, "light.colour")).toBeDefined();
    expect(lampState(hass, "light.missing")).toBeUndefined();
    expect(lampState(undefined, "light.colour")).toBeUndefined();

    expect(lampOn(hass, "light.colour")).toBe(true);
    expect(lampOn(hass, "light.off")).toBe(false);
    expect(lampOn(hass, "light.gone")).toBe(false);
    expect(lampOn(hass, "light.missing")).toBe(false);

    expect(lampUnavail(hass, "light.gone")).toBe(true);
    expect(lampUnavail(hass, "light.missing")).toBe(true);
    expect(lampUnavail(hass, "light.colour")).toBe(false);
  });
});

describe("attributes & capabilities", () => {
  test("lampAttr / lampModes", () => {
    expect(lampAttr(hass, "light.colour", "friendly_name")).toBe("Colour lamp");
    expect(lampAttr(hass, "light.off", "brightness")).toBeUndefined();
    expect(lampModes(hass, "light.warm")).toEqual(["color_temp"]);
    expect(lampModes(hass, "light.missing")).toEqual([]);
  });

  test("lampHasColor / lampHasTemp", () => {
    expect(lampHasColor(hass, "light.colour")).toBe(true);
    expect(lampHasColor(hass, "light.warm")).toBe(false);
    expect(lampHasTemp(hass, "light.warm")).toBe(true);
    expect(lampHasTemp(hass, "light.plain_on")).toBe(false);
  });

  test("lampHs falls back to [0,0]", () => {
    expect(lampHs(hass, "light.colour")).toEqual([210, 80]);
    expect(lampHs(hass, "light.warm")).toEqual([0, 0]);
  });

  test("lampKRange reads bounds, defaults to the strip, guards hi>lo", () => {
    expect(lampKRange(hass, "light.colour")).toEqual([2200, 6000]);
    expect(lampKRange(hass, "light.warm")).toEqual([STRIP_LO, STRIP_HI]);
  });

  test("lampKelvin is a number or null", () => {
    expect(lampKelvin(hass, "light.colour")).toBe(3000);
    expect(lampKelvin(hass, "light.off")).toBeNull();
  });
});

describe("swatchColor", () => {
  test("off is neutral grey", () => {
    expect(swatchColor(hass, "light.off")).toBe("#3a4446");
  });
  test("prefers rgb_color when present", () => {
    expect(swatchColor(hass, "light.colour")).toBe("rgb(40,120,255)");
  });
  test("on without any colour data is warm white", () => {
    expect(swatchColor(hass, "light.plain_on")).toBe("#ffe6c2");
    expect(swatchColor(hass, "light.warm")).toBe("#ffe6c2");
  });
});
