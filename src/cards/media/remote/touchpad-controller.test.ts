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
