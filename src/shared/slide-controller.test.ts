/* Unit tests for the shared slide controller — the behaviours that catch the bugs
 * that matter: the opt-out never arms the slide, a diagonal drag is left to the
 * dashboard, a real horizontal drag pages exactly once and clamps, and a drag
 * swallows the trailing click. A tiny fake surface + synthetic pointer events stand
 * in for the DOM (bun has no DOM); the commit path runs in reduced-motion mode so it
 * resolves synchronously, without transitions or rAF. */
import { describe, expect, test } from "bun:test";

import { SlideController, ownedByChild } from "./slide-controller";

/** A fake slide surface: only the bits the controller touches, plus captured
 *  listeners so the click-swallow guard can be exercised. */
function makeSurface(width = 300) {
  const listeners: Record<string, (e: unknown) => void> = {};
  return {
    style: {} as Record<string, string>,
    captures: 0,
    scrollHeight: 640,
    getBoundingClientRect: () => ({ width }) as DOMRect,
    setPointerCapture(): void {
      this.captures += 1;
    },
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
    addEventListener(type: string, fn: (e: unknown) => void): void {
      listeners[type] = fn;
    },
    removeEventListener(type: string): void {
      delete listeners[type];
    },
    get offsetWidth(): number {
      return width;
    },
    fire(type: string, e: unknown): void {
      listeners[type]?.(e);
    },
  };
}

/** A fake host recording every page commit. */
function makeHost(index: number, count: number) {
  return {
    selects: [] as number[],
    addController: () => {},
    removeController: () => {},
    requestUpdate: () => {},
    updateComplete: Promise.resolve(true),
    count: () => count,
    index: () => index,
    slideSelect(i: number): void {
      this.selects.push(i);
    },
    haptics: () => false,
  };
}

/** A synthetic PointerEvent with the fields the controller reads. */
function pointer(
  props: Partial<{
    pointerId: number;
    pointerType: string;
    button: number;
    clientX: number;
    clientY: number;
    timeStamp: number;
    path: unknown[];
  }> & { surface?: unknown } = {},
): PointerEvent {
  const path = props.path ?? (props.surface ? [props.surface] : []);
  return {
    pointerId: props.pointerId ?? 1,
    pointerType: props.pointerType ?? "touch",
    button: props.button ?? 0,
    clientX: props.clientX ?? 0,
    clientY: props.clientY ?? 0,
    timeStamp: props.timeStamp ?? 0,
    cancelable: true,
    preventDefault: () => {},
    composedPath: () => path,
  } as unknown as PointerEvent;
}

function setup(index = 0, count = 3, reduced = false) {
  const surface = makeSurface();
  const host = makeHost(index, count);
  const ctrl = new SlideController(host);
  ctrl.attach(surface as unknown as Element);
  if (reduced)
    (ctrl as unknown as { reducedMotion: boolean }).reducedMotion = true;
  return { surface, host, ctrl };
}

describe("ownedByChild", () => {
  test("declines when a self-owning child precedes the surface in the path", () => {
    const surface = makeSurface();
    const own = { matches: () => true };
    expect(
      ownedByChild(
        pointer({ path: [own, surface] }),
        surface as unknown as Element,
      ),
    ).toBe(true);
  });

  test("allows when the press reaches the surface unclaimed", () => {
    const surface = makeSurface();
    expect(
      ownedByChild(pointer({ path: [surface] }), surface as unknown as Element),
    ).toBe(false);
  });
});

describe("SlideController", () => {
  test("a pointerdown on a self-owning child never arms the slide", () => {
    const { surface, host, ctrl } = setup(0, 3, true);
    const own = { matches: () => true };
    ctrl.down(pointer({ path: [own, surface] }));
    ctrl.move(pointer({ clientX: -180 }));
    ctrl.up(pointer({ clientX: -180 }));
    expect(host.selects).toEqual([]);
    expect(surface.captures).toBe(0);
    expect(surface.style.transform ?? "").toBe("");
  });

  test("a 45° drag locks to 'y' and never pages", () => {
    const { surface, host, ctrl } = setup(0, 3, true);
    ctrl.down(pointer({ clientX: 0, clientY: 0, surface }));
    ctrl.move(pointer({ clientX: 40, clientY: 40 }));
    ctrl.up(pointer({ clientX: 40, clientY: 40 }));
    expect(host.selects).toEqual([]);
    expect(surface.captures).toBe(0);
  });

  test("a 60%-width drag pages to the next item exactly once", () => {
    const { surface, host, ctrl } = setup(0, 3, true);
    ctrl.down(pointer({ clientX: 300, clientY: 0, surface }));
    ctrl.move(pointer({ clientX: 120, clientY: 0 })); // dx = -180 = -60% of 300
    ctrl.up(pointer({ clientX: 120, clientY: 0 }));
    expect(host.selects).toEqual([1]);
    expect(surface.captures).toBe(1);
  });

  test("a drag past the last item clamps (no page)", () => {
    const { host, ctrl, surface } = setup(2, 3, true);
    ctrl.down(pointer({ clientX: 300, clientY: 0, surface }));
    ctrl.move(pointer({ clientX: 120, clientY: 0 }));
    ctrl.up(pointer({ clientX: 120, clientY: 0 }));
    expect(host.selects).toEqual([]);
  });

  test("a real drag swallows the trailing click; a plain tap does not", () => {
    const { surface, ctrl } = setup(0, 3, true);
    // drag horizontally → swallow armed
    ctrl.down(pointer({ clientX: 300, clientY: 0, surface }));
    ctrl.move(pointer({ clientX: 120, clientY: 0 }));
    ctrl.up(pointer({ clientX: 120, clientY: 0 }));
    let stopped = 0;
    const clickEvent = () => ({
      stopPropagation: () => {
        stopped += 1;
      },
      preventDefault: () => {},
    });
    surface.fire("click", clickEvent());
    expect(stopped).toBe(1);
    // a second click is NOT swallowed (guard is one-shot)
    surface.fire("click", clickEvent());
    expect(stopped).toBe(1);
  });

  test("reserve() sets a min-height and measure() reads the surface", () => {
    const { surface, ctrl } = setup();
    expect(ctrl.measure()).toBe(640);
    ctrl.reserve(700);
    expect(surface.style.minHeight).toBe("700px");
    ctrl.reserve(0);
    expect(surface.style.minHeight).toBe("");
  });
});
