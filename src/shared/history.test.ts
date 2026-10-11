import { describe, expect, test } from "bun:test";

import { HistoryController, sparklinePaths } from "./history";

describe("sparklinePaths", () => {
  test("spans the full width and pads the extremes off the edges", () => {
    const { line, area } = sparklinePaths([0, 10], 300, 40);
    // min/max padded by 12% of the range → the points sit inside 0..40
    expect(line).toBe("M0.0,36.1 L300.0,3.9");
    expect(area).toBe("M0,40 L0.0,36.1 L300.0,3.9 L300,40 Z");
  });
  test("a flat series draws a mid-height line, not NaN", () => {
    expect(sparklinePaths([5, 5, 5], 100, 10).line).not.toContain("NaN");
  });
});

describe("HistoryController", () => {
  const host = { requestUpdate: () => {} } as never;
  test("a literal series counts as settled", () => {
    const h = new HistoryController(host);
    h.reset([1, 2, 3]);
    expect(h.settled).toBe(true);
    expect(h.series).toEqual([1, 2, 3]);
  });
  test("reset to fetch clears the series and the settled flag", () => {
    const h = new HistoryController(host);
    h.reset([1, 2]);
    h.reset();
    expect(h.series).toBeNull();
    expect(h.settled).toBe(false);
  });
});
