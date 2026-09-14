/* Unit tests for the page-swipe controller — the three behaviours that catch the
 * bugs that matter: the touchpad opt-out never arms the deck, a diagonal drag is
 * left to the dashboard, and a real horizontal drag pages exactly once and clamps.
 * A tiny fake surface + synthetic pointer events stand in for the DOM (bun has no
 * DOM); the commit path is exercised in reduced-motion mode so it resolves
 * synchronously, without transitions or rAF. */
import { describe, expect, test } from "bun:test";

import { DeckController, ownedByChild } from "./deck-controller";

/** A fake deck surface: only the bits the controller touches. */
function makeSurface(width = 300) {
  return {
    style: {} as Record<string, string>,
    captures: 0,
    getBoundingClientRect: () => ({ width }) as DOMRect,
    setPointerCapture(): void {
      this.captures += 1;
    },
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    get offsetWidth(): number {
      return width;
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
    deckSelect(i: number): void {
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
  const ctrl = new DeckController(host);
  ctrl.attach(surface as unknown as Element);
  if (reduced)
    (ctrl as unknown as { reducedMotion: boolean }).reducedMotion = true;
  return { surface, host, ctrl };
}

describe("ownedByChild", () => {
  test("declines when a self-owning child precedes the deck in the path", () => {
    const surface = makeSurface();
    const own = { matches: () => true };
    expect(
      ownedByChild(
        pointer({ path: [own, surface] }),
        surface as unknown as Element,
      ),
    ).toBe(true);
  });

  test("allows when the press reaches the deck unclaimed", () => {
    const surface = makeSurface();
    expect(
      ownedByChild(pointer({ path: [surface] }), surface as unknown as Element),
    ).toBe(false);
  });
});

describe("DeckController", () => {
  test("a pointerdown on a self-owning child never arms the deck", () => {
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

  test("a 60%-width drag pages to the next device exactly once", () => {
    const { surface, host, ctrl } = setup(0, 3, true);
    ctrl.down(pointer({ clientX: 300, clientY: 0, surface }));
    ctrl.move(pointer({ clientX: 120, clientY: 0 })); // dx = -180 = -60% of 300
    ctrl.up(pointer({ clientX: 120, clientY: 0 }));
    expect(host.selects).toEqual([1]);
    expect(surface.captures).toBe(1);
  });

  test("a drag past the last device clamps (no page)", () => {
    const { host, ctrl, surface } = setup(2, 3, true);
    ctrl.down(pointer({ clientX: 300, clientY: 0, surface }));
    ctrl.move(pointer({ clientX: 120, clientY: 0 }));
    ctrl.up(pointer({ clientX: 120, clientY: 0 }));
    expect(host.selects).toEqual([]);
  });
});
