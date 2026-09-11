/* Unit tests for the pure touchpad step engine — velocity, step size, axis lock,
 * the drain/drop accumulator, edge zones, momentum, scrub mapping, live position. */
import { describe, expect, test } from "bun:test";

import {
  emaVelocity,
  stepSize,
  lockAxis,
  tryStep,
  isTap,
  edgeZone,
  momentumSchedule,
  scrubStep,
  livePosition,
  fmtTime,
  resolveTouchpadOptions,
  MIN_INTERVAL,
  MOMENTUM_MAX,
  MOMENTUM_STOP_MS,
  ACC_CLAMP_STEPS,
} from "./touchpad-math";

describe("emaVelocity", () => {
  test("blends 70/30 toward the instantaneous velocity", () => {
    expect(emaVelocity(0, 10, 10)).toBeCloseTo(0.3, 5);
    expect(emaVelocity(1, 10, 10)).toBeCloseTo(1, 5);
  });
  test("dt <= 0 leaves velocity unchanged (no divide-by-zero)", () => {
    expect(emaVelocity(0.5, 100, 0)).toBe(0.5);
    expect(emaVelocity(0.5, 100, -3)).toBe(0.5);
  });
});

describe("stepSize", () => {
  test("faster drag → smaller step (monotone non-increasing)", () => {
    const w = 240;
    const slow = stepSize(0, w, 1);
    const mid = stepSize(1, w, 1);
    const fast = stepSize(2, w, 1);
    expect(slow).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(fast);
  });
  test("clamped to [width/16, width/6]", () => {
    const w = 240;
    expect(stepSize(0, w, 1)).toBeCloseTo(40, 5); // width/6 at rest
    expect(stepSize(50, w, 1)).toBeGreaterThanOrEqual(w / 16); // never below floor
    expect(stepSize(0, w, 1)).toBeLessThanOrEqual(w / 6);
  });
  test("higher sensitivity shrinks the step (more steps per cm)", () => {
    expect(stepSize(0, 240, 2)).toBeLessThan(stepSize(0, 240, 1));
  });
});

describe("lockAxis", () => {
  test("no lock under AXIS_LOCK_PX of travel", () => {
    expect(lockAxis(5, 5, null)).toBeNull();
    expect(lockAxis(10, 3, null)).toBeNull();
  });
  test("locks to the dominant axis past the threshold", () => {
    expect(lockAxis(10, 8, null)).toBe("x");
    expect(lockAxis(3, 20, null)).toBe("y");
  });
  test("only breaks the lock past AXIS_BREAK× cross-axis travel", () => {
    expect(lockAxis(5, 10, "x")).toBe("x"); // 10 < 2.5*5
    expect(lockAxis(5, 20, "x")).toBe("y"); // 20 > 2.5*5
    expect(lockAxis(20, 5, "y")).toBe("x"); // 20 > 2.5*5
  });
});

describe("tryStep", () => {
  test("emits a step when full and past MIN_INTERVAL", () => {
    const r = tryStep(50, 38, 1000, 0, 0);
    expect(r).toEqual({ dir: 1, acc: 12, consumed: true });
  });
  test("negative accumulator emits a negative step", () => {
    const r = tryStep(-50, 38, 1000, 0, 0);
    expect(r.dir).toBe(-1);
    expect(r.acc).toBeCloseTo(-12, 5);
  });
  test("holds the accumulator when inside MIN_INTERVAL", () => {
    const r = tryStep(50, 38, MIN_INTERVAL - 30, 0, 0);
    expect(r).toEqual({ dir: 0, acc: 50, consumed: false });
  });
  test("at the in-flight cap the step is consumed-and-dropped, not queued", () => {
    const r = tryStep(50, 38, 1000, 0, 2);
    expect(r.dir).toBe(0);
    expect(r.consumed).toBe(true);
    expect(r.acc).toBeCloseTo(12, 5); // still drained — no backlog
  });
  test("a frantic accumulator is clamped to ACC_CLAMP_STEPS worth", () => {
    const step = 38;
    const r = tryStep(500, step, 1000, 0, 0);
    // clamped to 3*step=114, then one step drained → 76
    expect(r.acc).toBeCloseTo(ACC_CLAMP_STEPS * step - step, 5);
  });
  test("nothing to emit below one step", () => {
    expect(tryStep(20, 38, 1000, 0, 0)).toEqual({
      dir: 0,
      acc: 20,
      consumed: false,
    });
  });
});

describe("drain simulation (a ~10cm slow drag)", () => {
  test("a 230px slow drag emits 5±2 steps and nothing after the finger stops", () => {
    const width = 230;
    let acc = 0;
    let sentAt = -Infinity;
    let now = 0;
    let emitted = 0;
    // 60 moves of ~4px over 16ms each = ~240px total, slow (0.25 px/ms).
    for (let i = 0; i < 60; i += 1) {
      now += 16;
      acc += 4;
      const v = 0.25;
      const step = stepSize(v, width, 1);
      const r = tryStep(acc, step, now, sentAt, 0);
      acc = r.acc;
      if (r.dir !== 0) {
        emitted += 1;
        sentAt = now;
      }
    }
    expect(emitted).toBeGreaterThanOrEqual(4);
    expect(emitted).toBeLessThanOrEqual(7);
    // Finger stops: no more travel, drain a few idle frames → zero further emits.
    let after = 0;
    for (let i = 0; i < 20; i += 1) {
      now += 16;
      const r = tryStep(acc, stepSize(0, width, 1), now, sentAt, 0);
      acc = r.acc;
      if (r.dir !== 0) {
        after += 1;
        sentAt = now;
      }
    }
    // At most the residual sub-step already accumulated — never a stream.
    expect(after).toBeLessThanOrEqual(1);
  });
});

describe("isTap", () => {
  test("small move + no hold = tap", () => {
    expect(isTap(5, false)).toBe(true);
    expect(isTap(15, false)).toBe(false);
    expect(isTap(5, true)).toBe(false);
  });
});

describe("edgeZone", () => {
  test("centre is null, edges resolve to a direction", () => {
    expect(edgeZone(50, 50, 100, 100)).toBeNull();
    expect(edgeZone(5, 50, 100, 100)).toBe("left");
    expect(edgeZone(95, 50, 100, 100)).toBe("right");
    expect(edgeZone(50, 3, 100, 100)).toBe("up");
    expect(edgeZone(50, 97, 100, 100)).toBe("down");
  });
  test("a corner resolves to the deeper-penetrated edge", () => {
    expect(edgeZone(3, 10, 100, 100)).toBe("left"); // left(3) < top(10)
    expect(edgeZone(10, 3, 100, 100)).toBe("up"); // top(3) < left(10)
  });
});

describe("momentumSchedule", () => {
  test("a soft flick gives few steps, a hard one many, all decelerating", () => {
    const soft = momentumSchedule(0.7, 1);
    expect(soft.dir).toBe(1);
    expect(soft.delays.length).toBeGreaterThanOrEqual(2);
    const hard = momentumSchedule(3, -1);
    expect(hard.dir).toBe(-1);
    expect(hard.delays.length).toBeGreaterThan(soft.delays.length);
    expect(hard.delays.length).toBeLessThanOrEqual(MOMENTUM_MAX);
    // strictly increasing, floored at MIN_INTERVAL, capped at the stop threshold
    for (let i = 1; i < hard.delays.length; i += 1) {
      expect(hard.delays[i]).toBeGreaterThan(hard.delays[i - 1]);
    }
    expect(hard.delays[0]).toBeGreaterThanOrEqual(MIN_INTERVAL);
    expect(Math.max(...hard.delays)).toBeLessThanOrEqual(MOMENTUM_STOP_MS);
  });
});

describe("scrubStep", () => {
  test("a full-width slow sweep ≈ SCRUB_BASE_S seconds", () => {
    expect(scrubStep(240, 240, 0, 1)).toBeCloseTo(90, 5);
  });
  test("velocity multiplier caps at 2.5× (1 + min(v, 1.5))", () => {
    expect(scrubStep(240, 240, 10, 1)).toBeCloseTo(225, 5);
  });
  test("sensitivity scales the seek", () => {
    expect(scrubStep(240, 240, 0, 2)).toBeCloseTo(180, 5);
  });
});

describe("livePosition", () => {
  test("adds elapsed wall time while playing", () => {
    const p = livePosition(300, 1000, true, 6000, 5400);
    expect(p).toEqual({ pos: 305, dur: 5400 });
  });
  test("paused holds the reported position", () => {
    expect(livePosition(300, 1000, false, 6000, 5400)?.pos).toBe(300);
  });
  test("clamps to duration", () => {
    expect(livePosition(5399, 0, true, 10000, 5400)?.pos).toBe(5400);
  });
  test("null when position/duration are unusable", () => {
    expect(livePosition(NaN, 0, true, 0, 100)).toBeNull();
    expect(livePosition(10, 0, true, 0, 0)).toBeNull();
  });
});

describe("fmtTime", () => {
  test("m:ss under an hour, h:mm:ss past it, floored at 0", () => {
    expect(fmtTime(0)).toBe("0:00");
    expect(fmtTime(65)).toBe("1:05");
    expect(fmtTime(3661)).toBe("1:01:01");
    expect(fmtTime(-5)).toBe("0:00");
  });
});

describe("resolveTouchpadOptions", () => {
  test("defaults when unset", () => {
    expect(resolveTouchpadOptions(undefined)).toEqual({
      edge_click: true,
      momentum: true,
      haptics: true,
      sensitivity: 1,
      scrub: true,
    });
  });
  test("honours explicit flags and clamps out-of-range sensitivity to 1", () => {
    expect(
      resolveTouchpadOptions({ edge_click: false, scrub: false }),
    ).toMatchObject({ edge_click: false, scrub: false });
    expect(resolveTouchpadOptions({ sensitivity: 2 }).sensitivity).toBe(2);
    expect(resolveTouchpadOptions({ sensitivity: 10 }).sensitivity).toBe(1);
    expect(resolveTouchpadOptions({ sensitivity: 0.1 }).sensitivity).toBe(1);
  });
});
