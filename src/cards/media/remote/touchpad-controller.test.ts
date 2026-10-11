/* Unit tests for the controller's scrub-transport decision (`_scrubTransportFor`) —
 * the app_id gate that lets the Fibbers Bridge native touch win over nav left/right
 * even when Netflix reports `idle` while paused (the 1.1.0 regression fixed in 1.1.1).
 * The method only consults `nativeTouchReady()`, so a minimal fake host suffices. */
import { describe, expect, test } from "bun:test";

import { resolveTouchpadOptions } from "./touchpad-math";
import {
  TouchpadController,
  type PlaybackInfo,
  type TouchpadHost,
} from "./touchpad-controller";

type Transport = "native" | "seek" | "inert" | null;

// The controller constructs cleanly with all-stub host methods; `_scrubTransportFor`
// reaches back only for `nativeTouchReady()`, which varies per row.
function makeHost(bridgeReady: boolean): TouchpadHost {
  return {
    addController: () => {},
    removeController: () => {},
    requestUpdate: () => {},
    updateComplete: Promise.resolve(true),
    send: () => {},
    sendHold: () => {},
    holdRepeat: () => {},
    holdRelease: () => {},
    mediaDo: () => {},
    playback: () => null,
    nativeTouchReady: () => bridgeReady,
    nativeTouch: () => {},
    unavail: () => false,
    opts: () => resolveTouchpadOptions(undefined),
    debug: () => false,
  };
}

interface ScrubProbe {
  _scrubTransportFor(pb: PlaybackInfo): Transport;
}

function transportFor(
  pb: Partial<PlaybackInfo>,
  bridgeReady: boolean,
): Transport {
  const ctrl = new TouchpadController(makeHost(bridgeReady));
  const full: PlaybackInfo = {
    state: "idle",
    appId: "",
    seekable: false,
    pos: NaN,
    dur: NaN,
    ...pb,
  };
  return (ctrl as unknown as ScrubProbe)._scrubTransportFor(full);
}

const NETFLIX = "com.netflix.Netflix";

describe("_scrubTransportFor", () => {
  test("Netflix playing + bridge → native", () => {
    expect(transportFor({ state: "playing", appId: NETFLIX }, true)).toBe(
      "native",
    );
  });
  test("Netflix paused (reports idle) + bridge → native (the regression)", () => {
    expect(transportFor({ state: "idle", appId: NETFLIX }, true)).toBe(
      "native",
    );
  });
  test("tvOS home screen (empty app_id) + bridge → null (nav, not scrub)", () => {
    expect(transportFor({ state: "idle", appId: "" }, true)).toBeNull();
  });
  test("Netflix playing, no bridge, no timeline → inert (consume, don't skip)", () => {
    expect(
      transportFor(
        { state: "playing", appId: NETFLIX, seekable: false },
        false,
      ),
    ).toBe("inert");
  });
  test("seekable app playing, no bridge → seek", () => {
    expect(
      transportFor(
        { state: "playing", appId: "com.app.player", seekable: true },
        false,
      ),
    ).toBe("seek");
  });
  test("off + empty app_id + bridge → null", () => {
    expect(transportFor({ state: "off", appId: "" }, true)).toBeNull();
  });
});

// --- scrub session behaviour (private methods driven directly; no DOM/rAF) ---

interface Call {
  kind: string;
  args: unknown[];
}

interface ScrubDriver {
  phase: string;
  downX: number;
  downY: number;
  rect: DOMRect | null;
  _startScrub(pb: PlaybackInfo, t: string, x: number, y: number): void;
  _driveScrub(e: PointerEvent, dx: number, t: number, s: number): void;
  hostUpdated(): void;
  abort(): void;
}

function harness(pb: PlaybackInfo | null, bridgeReady: boolean) {
  const calls: Call[] = [];
  let live = pb;
  const host: TouchpadHost = {
    ...makeHost(bridgeReady),
    mediaDo: (...args) => calls.push({ kind: "media", args }),
    nativeTouch: (...args) => calls.push({ kind: "native", args }),
    playback: () => live,
  };
  const ctrl = new TouchpadController(host) as unknown as ScrubDriver;
  ctrl.rect = { left: 0, top: 0, width: 200, height: 200 } as DOMRect;
  return {
    ctrl,
    calls,
    set: (p: PlaybackInfo | null) => {
      live = p;
    },
  };
}

const move = (x: number): PointerEvent =>
  ({ clientX: x, clientY: 100 }) as PointerEvent;

describe("scrub sessions", () => {
  const playing: PlaybackInfo = {
    state: "playing",
    appId: "com.app.player",
    seekable: true,
    pos: 600,
    dur: 3600,
  };

  test("a fresh seek-scrub sends live seeks before release", () => {
    const { ctrl, calls } = harness(playing, false);
    ctrl._startScrub(playing, "seek", 100, 100);
    ctrl._driveScrub(move(140), 40, 1000, 1);
    const seeks = calls.filter(
      (c) => c.kind === "media" && c.args[0] === "media_seek",
    );
    expect(seeks.length).toBe(1);
  });

  test("native press lands at the pointer-down origin, then catches up", () => {
    const pb = { ...playing, seekable: false };
    const { ctrl, calls } = harness(pb, true);
    ctrl.downX = 50;
    ctrl.downY = 100;
    ctrl._startScrub(pb, "native", 70, 100);
    const native = calls.filter((c) => c.kind === "native");
    expect(native[0].args).toEqual(["press", 250, 500]);
    expect(native[1].args).toEqual(["hold", 350, 500]);
    ctrl.abort();
  });

  test("a native scrub survives Netflix reporting idle mid-drag", () => {
    const pb = { ...playing, appId: NETFLIX, seekable: false };
    const h = harness(pb, true);
    h.ctrl._startScrub(pb, "native", 100, 100);
    h.set({ ...pb, state: "idle" });
    h.ctrl.hostUpdated();
    expect(h.ctrl.phase).toBe("scrub");
    expect(h.calls.some((c) => c.args[0] === "release")).toBe(false);
    h.set({ ...pb, state: "idle", appId: "" });
    h.ctrl.hostUpdated();
    expect(h.ctrl.phase).toBe("idle");
    expect(h.calls.some((c) => c.args[0] === "release")).toBe(true);
  });
});
