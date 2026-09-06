/* Unit tests for the colour conversions. rgbToKelvin is McCamy's approximation —
 * assertions pin relative warmth ordering and a sane white point, not exact CCTs. */
import { describe, expect, test } from "bun:test";

import { hsToRgb, rgbToKelvin } from "./color";

describe("hsToRgb", () => {
  test("full-saturation primaries land exactly", () => {
    expect(hsToRgb(0, 100)).toEqual([255, 0, 0]);
    expect(hsToRgb(120, 100)).toEqual([0, 255, 0]);
    expect(hsToRgb(240, 100)).toEqual([0, 0, 255]);
  });

  test("zero saturation is white regardless of hue", () => {
    expect(hsToRgb(0, 0)).toEqual([255, 255, 255]);
    expect(hsToRgb(217, 0)).toEqual([255, 255, 255]);
  });

  test("secondaries mix the neighbouring primaries", () => {
    const [r, g, b] = hsToRgb(60, 100); // yellow
    expect(r).toBeCloseTo(255);
    expect(g).toBeCloseTo(255);
    expect(b).toBeCloseTo(0);
  });

  test("every component stays within 0-255", () => {
    for (const h of [0, 37, 90, 150, 210, 275, 330, 359]) {
      for (const s of [0, 25, 63, 100]) {
        for (const c of hsToRgb(h, s)) {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  test("partial saturation lifts the floor toward white", () => {
    const [r, g, b] = hsToRgb(0, 60); // 60%-sat red: full red, 40% floor elsewhere
    expect(r).toBeCloseTo(255);
    expect(g).toBeCloseTo(102);
    expect(b).toBeCloseTo(102);
  });
});

describe("rgbToKelvin", () => {
  test("warm colours read lower kelvin than cool bluish ones", () => {
    const warm = rgbToKelvin(hsToRgb(30, 60)); // soft orange
    const cool = rgbToKelvin(hsToRgb(210, 60)); // soft blue
    expect(warm).toBeLessThan(cool);
  });

  test("pure white lands near daylight (roughly 5000-7000K)", () => {
    const k = rgbToKelvin([255, 255, 255]);
    expect(k).toBeGreaterThan(5000);
    expect(k).toBeLessThan(7000);
  });

  test("warmth ordering is monotone across a warm→cool sweep", () => {
    const sweep = [30, 60, 180, 210].map((h) => rgbToKelvin(hsToRgb(h, 50)));
    for (let i = 1; i < sweep.length; i++) {
      expect(sweep[i - 1]).toBeLessThan(sweep[i]);
    }
  });
});
