/* Unit tests for the shared slide/paging math — axis lock, velocity, resistance,
 * edge detection and the commit target. */
import { describe, expect, test } from "bun:test";

import {
  lockAxis,
  emaVelocity,
  resist,
  atEdge,
  commitTarget,
  SLOP,
  FLICK_V,
} from "./slide-math";

describe("lockAxis", () => {
  test("inside the slop radius is undecided (null)", () => {
    expect(lockAxis(3, 3)).toBeNull();
    expect(lockAxis(SLOP - 1, 0)).toBeNull();
  });

  test("a 45° drag locks to 'y' — the cone is strict (30° of horizontal)", () => {
    expect(lockAxis(30, 30)).toBe("y");
  });

  test("pure horizontal locks to 'x'", () => {
    expect(lockAxis(40, 0)).toBe("x");
    expect(lockAxis(-40, 2)).toBe("x");
  });
});

describe("emaVelocity", () => {
  test("ignores a non-positive dt (keeps the previous value)", () => {
    expect(emaVelocity(0.5, 20, 0)).toBe(0.5);
    expect(emaVelocity(0.5, 20, -4)).toBe(0.5);
  });

  test("blends 70/30 toward the new sample", () => {
    // 0 * 0.7 + (30/10) * 0.3 = 0.9
    expect(emaVelocity(0, 30, 10)).toBeCloseTo(0.9, 6);
  });
});

describe("resist", () => {
  test("is identity off the edge", () => {
    expect(resist(50, 300, false)).toBe(50);
  });

  test("compresses on the edge", () => {
    const out = resist(150, 300, true);
    expect(Math.abs(out)).toBeLessThan(150);
    expect(Math.sign(out)).toBe(1);
  });

  test("width <= 0 is identity", () => {
    expect(resist(50, 0, true)).toBe(50);
  });
});

describe("atEdge", () => {
  test("dragging right (dx > 0) at the first page is an edge", () => {
    expect(atEdge(0, 3, 20)).toBe(true);
  });

  test("dragging left (dx < 0) at the last page is an edge", () => {
    expect(atEdge(2, 3, -20)).toBe(true);
  });

  test("the middle is never an edge", () => {
    expect(atEdge(1, 3, 20)).toBe(false);
    expect(atEdge(1, 3, -20)).toBe(false);
  });
});

describe("commitTarget", () => {
  test("commits to the next page on 51% travel", () => {
    expect(commitTarget(0, 3, -153, 300, 0)).toBe(1);
  });

  test("refuses a sub-threshold drag (30% travel, no flick)", () => {
    expect(commitTarget(1, 3, -90, 300, 0)).toBe(1);
  });

  test("commits on a 25px flick", () => {
    expect(commitTarget(0, 3, -25, 300, FLICK_V + 0.1)).toBe(1);
  });

  test("refuses a 20px flick — too little travel", () => {
    expect(commitTarget(0, 3, -20, 300, FLICK_V + 0.1)).toBe(0);
  });

  test("clamps at the last index (never wraps forward)", () => {
    expect(commitTarget(2, 3, -200, 300, 0)).toBe(2);
  });

  test("clamps at the first index (never wraps back)", () => {
    expect(commitTarget(0, 3, 200, 300, 0)).toBe(0);
  });
});
