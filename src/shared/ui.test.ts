/* Unit tests for the pure gesture/keyboard logic in ui.ts: the pointerDrag
 * state machine, the relative sliderDrag built on it, setupSlider's wiring, and
 * stepFromKey. The lit templates (sliderTrack, pillSwitch, overflowChips) are
 * DOM-bound and exercised through the storybook stories instead. */
import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";

import type { ReactiveControllerHost } from "lit";
import { pointerDrag, sliderDrag, setupSlider, stepFromKey } from "./ui";

// A PointerEvent stand-in: the gesture code only reads pointerId/clientX/clientY/
// currentTarget, and capturePointer no-ops on an element without setPointerCapture.
const ev = (pointerId: number, x: number, y = 0): PointerEvent =>
  ({
    pointerId,
    clientX: x,
    clientY: y,
    currentTarget: {},
  }) as unknown as PointerEvent;

const stubHost = (): ReactiveControllerHost => ({
  addController() {},
  removeController() {},
  requestUpdate() {},
  updateComplete: Promise.resolve(true),
});

describe("pointerDrag", () => {
  test("down → move past slop → up ends with the event and moved=true", () => {
    const ends: [boolean, boolean][] = []; // [gotEvent, moved]
    const d = pointerDrag({
      end: (e, s) => ends.push([e != null, s.moved]),
    });
    d.down(ev(1, 10));
    d.move(ev(1, 20));
    d.up(ev(1, 20));
    expect(ends).toEqual([[true, true]]);
  });

  test("a stationary tap stays under the slop", () => {
    let moved: boolean | null = null;
    const d = pointerDrag({
      end: (_e, s) => {
        moved = s.moved;
      },
    });
    d.down(ev(1, 10));
    d.move(ev(1, 12, 2)); // < 4px euclidean
    d.up(ev(1, 12, 2));
    expect(moved!).toBe(false);
  });

  test("a second finger cannot join or end the gesture", () => {
    let starts = 0;
    let ends = 0;
    const moves: number[] = [];
    const d = pointerDrag({
      start: () => {
        starts += 1;
      },
      move: (e) => moves.push(e.pointerId),
      end: () => {
        ends += 1;
      },
    });
    d.down(ev(1, 10));
    d.down(ev(2, 50)); // palm/second finger
    d.move(ev(2, 60));
    d.up(ev(2, 60));
    expect(starts).toBe(1);
    expect(moves).toEqual([]);
    expect(ends).toBe(0);
    d.up(ev(1, 30));
    expect(ends).toBe(1);
  });

  test("lostpointercapture after a normal release is a no-op", () => {
    const ends: boolean[] = [];
    const d = pointerDrag({ end: (e) => ends.push(e != null) });
    d.down(ev(1, 10));
    d.up(ev(1, 20));
    d.lost(ev(1, 20)); // browsers always fire this after release
    expect(ends).toEqual([true]);
  });

  test("a mid-drag capture loss cancels (end with null)", () => {
    const ends: boolean[] = [];
    const d = pointerDrag({ end: (e) => ends.push(e != null) });
    d.down(ev(1, 10));
    d.lost(ev(1, 10));
    expect(ends).toEqual([false]);
  });

  test("pointercancel for another pointer is ignored; matching cancels", () => {
    const ends: boolean[] = [];
    const d = pointerDrag({ end: (e) => ends.push(e != null) });
    d.down(ev(1, 10));
    d.cancel(ev(2, 0));
    expect(ends).toEqual([]);
    d.cancel(ev(1, 0));
    expect(ends).toEqual([false]);
  });

  test("start returning false rejects the gesture", () => {
    const ends: unknown[] = [];
    const d = pointerDrag({
      start: () => false,
      end: (e) => ends.push(e),
    });
    d.down(ev(1, 10));
    d.up(ev(1, 10));
    expect(ends).toEqual([]);
  });

  test("abort cancels once; a second abort is a no-op", () => {
    let ends = 0;
    const d = pointerDrag({
      end: () => {
        ends += 1;
      },
    });
    d.down(ev(1, 10));
    d.abort();
    d.abort();
    expect(ends).toBe(1);
  });
});

describe("sliderDrag (relative + tap-to-set)", () => {
  interface Log {
    frames: [number | null, boolean][];
    lives: number[];
    ends: (number | null)[];
  }
  const make = (
    opts: { base?: () => number; guard?: () => boolean } = {},
  ): { d: ReturnType<typeof sliderDrag>; log: Log } => {
    const log: Log = { frames: [], lives: [], ends: [] };
    const d = sliderDrag({
      read: (e) => e.clientX, // value space = clientX for the tests
      base: opts.base,
      guard: opts.guard,
      frame: (v, dragging) => log.frames.push([v, dragging]),
      live: (v) => log.lives.push(v),
      end: (v) => log.ends.push(v),
    });
    return { d, log };
  };

  test("down frames the BASE value — no jump to the finger", () => {
    const { d, log } = make({ base: () => 50 });
    d.down(ev(1, 20));
    expect(log.frames).toEqual([[50, true]]);
  });

  test("dragging adjusts relative to the base", () => {
    const { d, log } = make({ base: () => 50 });
    d.down(ev(1, 20));
    d.move(ev(1, 30)); // +10 from the grab point
    expect(log.lives).toEqual([60]);
    d.up(ev(1, 25)); // net +5
    expect(log.ends).toEqual([55]);
  });

  test("a stationary tap sets the tapped position on release", () => {
    const { d, log } = make({ base: () => 50 });
    d.down(ev(1, 20));
    d.up(ev(1, 20));
    expect(log.ends).toEqual([20]); // tap-to-set, not base
    expect(log.lives).toEqual([]); // and exactly one commit — on release
  });

  test("sub-slop jitter neither frames nor commits", () => {
    const { d, log } = make({ base: () => 50 });
    d.down(ev(1, 20));
    d.move(ev(1, 22, 1));
    expect(log.lives).toEqual([]);
    expect(log.frames).toEqual([[50, true]]);
  });

  test("base + delta clamps to [0,100] by default", () => {
    const { d, log } = make({ base: () => 50 });
    d.down(ev(1, 90));
    d.move(ev(1, 10)); // -80 → unclamped -30
    expect(log.lives).toEqual([0]);
  });

  test("without base the drag is absolute (legacy mode)", () => {
    const { d, log } = make();
    d.down(ev(1, 20));
    expect(log.frames).toEqual([[20, true]]);
    d.move(ev(1, 35));
    expect(log.lives).toEqual([35]);
  });

  test("cancel frames null and ends null", () => {
    const { d, log } = make({ base: () => 50 });
    d.down(ev(1, 20));
    d.move(ev(1, 40));
    d.cancel(ev(1, 40));
    expect(log.frames[log.frames.length - 1]).toEqual([null, false]);
    expect(log.ends).toEqual([null]);
  });

  test("guard rejects the gesture entirely", () => {
    const { d, log } = make({ base: () => 50, guard: () => true });
    d.down(ev(1, 20));
    d.up(ev(1, 20));
    expect(log.frames).toEqual([]);
    expect(log.ends).toEqual([]);
  });
});

describe("setupSlider", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("a drag release flushes the commit immediately and arms the hold", () => {
    const commits: number[] = [];
    const s = setupSlider({
      host: stubHost(),
      read: (e) => e.clientX,
      base: () => 50,
      commit: (v) => {
        commits.push(v);
      },
    });
    s.drag.down(ev(1, 20));
    s.drag.move(ev(1, 30));
    s.drag.up(ev(1, 30));
    expect(commits).toEqual([60]); // flushed on release, not after 150ms
    expect(s.value(10)).toBe(60); // hold keeps the committed value on screen
  });

  test("keyboard input debounces the write but advances the display now", () => {
    const commits: number[] = [];
    const s = setupSlider({
      host: stubHost(),
      read: (e) => e.clientX,
      base: () => 50,
      commit: (v) => {
        commits.push(v);
      },
    });
    s.input(55);
    s.input(60);
    expect(s.value(50)).toBe(60);
    expect(commits).toEqual([]);
    jest.advanceTimersByTime(150);
    expect(commits).toEqual([60]);
  });

  test("a rejected commit clears the hold", async () => {
    const s = setupSlider({
      host: stubHost(),
      read: (e) => e.clientX,
      base: () => 50,
      commit: () => Promise.reject(new Error("boom")),
    });
    s.drag.down(ev(1, 20));
    s.drag.up(ev(1, 20));
    await Promise.resolve(); // let the rejection handler run
    await Promise.resolve();
    expect(s.value(50)).toBe(50); // back on the entity value
  });

  test("a cancelled drag commits nothing", () => {
    const commits: number[] = [];
    const s = setupSlider({
      host: stubHost(),
      read: (e) => e.clientX,
      base: () => 50,
      commit: (v) => {
        commits.push(v);
      },
    });
    s.drag.down(ev(1, 20));
    s.drag.move(ev(1, 40));
    s.drag.cancel(ev(1, 40));
    jest.advanceTimersByTime(1000);
    expect(commits).toEqual([]);
    expect(s.dragging).toBe(false);
  });
});

describe("stepFromKey", () => {
  const range = { value: 50, min: 0, max: 100, step: 5 };

  test("arrows step by one step, clamped", () => {
    expect(stepFromKey("ArrowRight", range)).toBe(55);
    expect(stepFromKey("ArrowLeft", range)).toBe(45);
    expect(stepFromKey("ArrowLeft", { ...range, value: 2 })).toBe(0);
  });

  test("Home/End hit the bounds; PageUp jumps a tenth of the range", () => {
    expect(stepFromKey("Home", range)).toBe(0);
    expect(stepFromKey("End", range)).toBe(100);
    expect(stepFromKey("PageUp", range)).toBe(60);
  });

  test("unhandled keys return null", () => {
    expect(stepFromKey("a", range)).toBeNull();
    expect(stepFromKey("Enter", range)).toBeNull();
  });
});
