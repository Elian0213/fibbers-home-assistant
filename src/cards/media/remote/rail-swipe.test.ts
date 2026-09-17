/* Unit tests for the rail's slide-to-switch gesture — the wireSwipe behaviours that
 * matter: a tap passes through, a drag commits the nearest tab and swallows the
 * trailing click, a vertical first move drops the gesture, touch never takes
 * explicit capture (and survives a child's bubbling lostpointercapture), and a
 * flick advances one tab. Fake rail/tabs stand in for the DOM (bun has no DOM). */
import { describe, expect, test } from "bun:test";

import { RailSwipe } from "./rail-swipe";

/** A fake rail tab with the geometry and attribute surface the controller touches. */
function makeTab(x: number) {
  const attrs = new Set<string>();
  return {
    offsetLeft: x,
    offsetTop: 4,
    offsetWidth: 100,
    offsetHeight: 36,
    setAttribute: (n: string) => attrs.add(n),
    removeAttribute: (n: string) => attrs.delete(n),
    over: () => attrs.has("data-over"),
  };
}

/** A fake rail: tab lookup, the pill, dataset, capture counting, and captured
 *  listeners so the click-swallow guard can be exercised. */
function makeRail(tabCount = 3) {
  const tabs = Array.from({ length: tabCount }, (_, i) => makeTab(i * 100));
  const ind = { style: {} as Record<string, string> };
  const listeners: Record<string, (e: unknown) => void> = {};
  return {
    tabs,
    ind,
    dataset: {} as Record<string, string>,
    captures: 0,
    setPointerCapture(): void {
      this.captures += 1;
    },
    querySelectorAll: () => tabs,
    querySelector: (sel: string) => (sel === ".rind" ? ind : null),
    addEventListener(type: string, fn: (e: unknown) => void): void {
      listeners[type] = fn;
    },
    removeEventListener(type: string): void {
      delete listeners[type];
    },
    fire(type: string, e: unknown): void {
      listeners[type]?.(e);
    },
  };
}

/** A fake host recording committed selections. */
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
    target: unknown;
  }> = {},
): PointerEvent {
  return {
    pointerId: props.pointerId ?? 1,
    pointerType: props.pointerType ?? "touch",
    button: props.button ?? 0,
    clientX: props.clientX ?? 0,
    clientY: props.clientY ?? 0,
    timeStamp: props.timeStamp ?? 0,
    target: props.target,
  } as unknown as PointerEvent;
}

function setup(index = 0, count = 3) {
  const rail = makeRail(count);
  const host = makeHost(index, count);
  const swipe = new RailSwipe(host);
  swipe.attach(rail as unknown as Element);
  return { rail, host, swipe };
}

describe("RailSwipe", () => {
  test("a stationary tap commits nothing and keeps its click", () => {
    const { rail, host, swipe } = setup();
    swipe.down(pointer({ clientX: 50 }));
    swipe.up(pointer({ clientX: 52 })); // under the 6px slop
    expect(host.selects).toEqual([]);
    let stopped = 0;
    rail.fire("click", {
      stopPropagation: () => {
        stopped += 1;
      },
    });
    expect(stopped).toBe(0);
  });

  test("a touch drag past the next tab's midpoint commits it, capture-free", () => {
    const { rail, host, swipe } = setup(0, 3);
    swipe.down(pointer({ clientX: 50 }));
    swipe.move(pointer({ clientX: 130 })); // pill x = +80 → nearest tab 1
    expect(rail.dataset.drag).toBe(""); // drag styling armed
    expect(rail.tabs[1].over()).toBe(true); // live recolour follows the pill
    swipe.up(pointer({ clientX: 130 }));
    expect(host.selects).toEqual([1]);
    expect(rail.captures).toBe(0); // touch rides implicit capture — never explicit
  });

  test("a mouse drag takes explicit capture on lock", () => {
    const { rail, host, swipe } = setup(0, 3);
    swipe.down(pointer({ pointerType: "mouse", clientX: 50 }));
    swipe.move(pointer({ pointerType: "mouse", clientX: 130 }));
    swipe.up(pointer({ pointerType: "mouse", clientX: 130 }));
    expect(host.selects).toEqual([1]);
    expect(rail.captures).toBe(1);
  });

  test("a drag swallows the trailing click exactly once", () => {
    const { rail, swipe } = setup(0, 3);
    swipe.down(pointer({ clientX: 50 }));
    swipe.move(pointer({ clientX: 130 }));
    swipe.up(pointer({ clientX: 130 }));
    let stopped = 0;
    const click = () => ({
      stopPropagation: () => {
        stopped += 1;
      },
      preventDefault: () => {},
    });
    rail.fire("click", click());
    rail.fire("click", click());
    expect(stopped).toBe(1);
  });

  test("a mostly-vertical first move drops the gesture", () => {
    const { host, swipe } = setup(0, 3);
    swipe.down(pointer({ clientX: 50, clientY: 0 }));
    swipe.move(pointer({ clientX: 53, clientY: 20 }));
    swipe.up(pointer({ clientX: 53, clientY: 20 }));
    expect(host.selects).toEqual([]);
  });

  test("a child's bubbling lostpointercapture never aborts a live touch drag", () => {
    const { host, swipe } = setup(0, 3);
    const child = {};
    swipe.down(pointer({ clientX: 50 }));
    swipe.move(pointer({ clientX: 130 }));
    swipe.lost(pointer({ target: child })); // a tab's implicit-capture release
    swipe.up(pointer({ clientX: 130 }));
    expect(host.selects).toEqual([1]); // drag survived and committed
  });

  test("the rail losing its own capture aborts the drag", () => {
    const { rail, host, swipe } = setup(0, 3);
    swipe.down(pointer({ pointerType: "mouse", clientX: 50 }));
    swipe.move(pointer({ pointerType: "mouse", clientX: 130 }));
    swipe.lost(pointer({ target: rail }));
    swipe.up(pointer({ pointerType: "mouse", clientX: 130 }));
    expect(host.selects).toEqual([]);
    expect(rail.dataset.drag).toBeUndefined(); // rail back at rest
  });

  test("a decisive flick advances one tab even short of the midpoint", () => {
    const { host, swipe } = setup(1, 3);
    swipe.down(pointer({ clientX: 200, timeStamp: 0 }));
    swipe.move(pointer({ clientX: 190, timeStamp: 10 })); // lock (dx −10)
    swipe.move(pointer({ clientX: 170, timeStamp: 20 })); // vx = −2 px/ms
    swipe.up(pointer({ clientX: 170, timeStamp: 30 })); // dx −30: short of midpoint
    expect(host.selects).toEqual([0]);
  });

  test("a single-device rail never arms", () => {
    const { host, swipe } = setup(0, 1);
    swipe.down(pointer({ clientX: 50 }));
    swipe.move(pointer({ clientX: 130 }));
    swipe.up(pointer({ clientX: 130 }));
    expect(host.selects).toEqual([]);
  });
});
