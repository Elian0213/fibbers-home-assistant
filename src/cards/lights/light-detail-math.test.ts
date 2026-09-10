/* Unit tests for the wheel geometry — pure hue/sat/kelvin → disc coordinates.
 * The wheel is a donut: colour on an outer ring, warm on a centre track. */
import { describe, expect, test } from "bun:test";

import {
  STRIP_LO,
  STRIP_HI,
  RING_IN,
  RING_OUT,
  CENTER_W,
  hueDiff,
  colourXY,
  warmFrac,
  warmXY,
  warmFracAt,
  colourAt,
  hueToKelvin,
  sameColour,
} from "./light-detail-math";

describe("hueDiff", () => {
  test("is the shortest way round the circle", () => {
    expect(hueDiff(90, 90)).toBe(0);
    expect(hueDiff(0, 180)).toBe(180);
    expect(hueDiff(10, 350)).toBe(20); // wraps across 0°
    expect(hueDiff(0, 270)).toBe(90);
  });
});

describe("colourXY (ring band)", () => {
  test("zero saturation sits on the inner ring edge (not the centre)", () => {
    expect(colourXY(0, 0).x).toBeCloseTo(50);
    expect(colourXY(0, 0).y).toBeCloseTo(50 - RING_IN); // hue 0° is up
    expect(colourXY(90, 0).x).toBeCloseTo(50 + RING_IN); // hue 90° is right
    expect(colourXY(90, 0).y).toBeCloseTo(50);
  });

  test("full saturation lands on the outer rim", () => {
    expect(colourXY(0, 100).y).toBeCloseTo(50 - RING_OUT);
    expect(colourXY(90, 100).x).toBeCloseTo(50 + RING_OUT);
    expect(colourXY(180, 100).y).toBeCloseTo(50 + RING_OUT); // bottom
    expect(colourXY(270, 100).x).toBeCloseTo(50 - RING_OUT); // left
  });
});

describe("warmFrac / warmXY", () => {
  test("fraction spans the strip and clamps outside it", () => {
    expect(warmFrac(STRIP_LO)).toBeCloseTo(0);
    expect(warmFrac(STRIP_HI)).toBeCloseTo(1);
    expect(warmFrac((STRIP_LO + STRIP_HI) / 2)).toBeCloseTo(0.5);
    expect(warmFrac(STRIP_LO - 1000)).toBe(0);
    expect(warmFrac(STRIP_HI + 1000)).toBe(1);
  });

  test("warm markers ride the centre track (y = 50)", () => {
    expect(warmXY(STRIP_LO)).toEqual({ x: 50 - CENTER_W / 2, y: 50 });
    expect(warmXY(STRIP_HI)).toEqual({ x: 50 + CENTER_W / 2, y: 50 });
    expect(warmXY((STRIP_LO + STRIP_HI) / 2).x).toBeCloseTo(50);
  });
});

describe("warmFracAt", () => {
  const rect = { left: 0, width: 100 } as DOMRect;
  test("maps pointer x across the centre track to 0..1", () => {
    expect(warmFracAt(50 - CENTER_W / 2, rect)).toBeCloseTo(0);
    expect(warmFracAt(50 + CENTER_W / 2, rect)).toBeCloseTo(1);
    expect(warmFracAt(50, rect)).toBeCloseTo(0.5);
  });
});

describe("colourAt", () => {
  const evAt = (x: number, y: number): PointerEvent =>
    ({
      clientX: x,
      clientY: y,
      currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
    }) as unknown as PointerEvent;

  test("straight up is hue 0°, right is 90°; the rim is full saturation", () => {
    const R = 100; // centre at (100,100)
    const up = colourAt(evAt(100, 0), R); // dx 0, dy -100 → rim, up
    expect(up[0]).toBeCloseTo(0);
    expect(up[1]).toBeCloseTo(100);
    const right = colourAt(evAt(200, 100), R); // dx 100, dy 0 → rim, right
    expect(right[0]).toBeCloseTo(90);
    expect(right[1]).toBeCloseTo(100);
  });

  test("the centre clamps saturation to 0; mid-band maps proportionally", () => {
    const R = 100;
    expect(colourAt(evAt(100, 100), R)[1]).toBeCloseTo(0); // dead centre
    // A point at disc-% radius (RING_IN+RING_OUT)/2 → saturation ~50.
    const midDiscR = (RING_IN + RING_OUT) / 2; // disc-% radius
    const distPx = (midDiscR / 50) * R; // back to pixels
    expect(colourAt(evAt(100, 100 - distPx), R)[1]).toBeCloseTo(50, 0);
  });
});

describe("hueToKelvin", () => {
  test("stays inside the strip and keeps warm < cool", () => {
    const warm = hueToKelvin(30, 60);
    const cool = hueToKelvin(210, 60);
    expect(warm).toBeGreaterThanOrEqual(STRIP_LO);
    expect(cool).toBeLessThanOrEqual(STRIP_HI);
    expect(warm).toBeLessThan(cool);
  });
});

describe("sameColour (auto-group predicate)", () => {
  test("near-identical colours group; clearly different hues don't", () => {
    expect(sameColour([210, 80], [211, 80])).toBe(true);
    expect(sameColour([210, 80], [30, 80])).toBe(false);
  });

  test("zero-saturation lamps are the same white regardless of hue", () => {
    // Lab-based: white is white — a hue that carries no chroma can't split them.
    expect(sameColour([0, 0], [180, 0])).toBe(true);
  });
});
