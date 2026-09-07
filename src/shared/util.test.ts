/* Unit tests for the pure helpers in util.ts. DOM-bound helpers (deepFind,
 * capturePointer, moreInfo, here, navigate, fetchHistory) need a real
 * document/window and are exercised through the storybook stories instead. */
import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";

import type { HassEntity, HomeAssistant } from "@/types/home-assistant";
import {
  brightnessPct,
  clamp,
  cssUrl,
  debounce,
  fmtNum,
  fmtState,
  isUnavail,
  norm,
  pctFromX,
  pickEntity,
  snapToStep,
  store,
} from "./util";

const hassWith = (o: object): HomeAssistant => o as unknown as HomeAssistant;
const ent = (o: object): HassEntity => o as unknown as HassEntity;

describe("clamp", () => {
  test("passes an in-range value through", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  test("clamps below lo and above hi", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  test("NaN collapses to lo", () => {
    expect(clamp(NaN, 3, 10)).toBe(3);
    expect(clamp(Number(""), 3, 10)).toBe(3);
  });

  test("any non-finite value collapses to lo — even +Infinity", () => {
    expect(clamp(Infinity, 0, 10)).toBe(0);
    expect(clamp(-Infinity, 0, 10)).toBe(0);
  });
});

describe("fmtNum", () => {
  test("fixes decimals with d", () => {
    expect(fmtNum(null, 3.14159, 2)).toBe("3.14");
    expect(fmtNum(null, 5, 2)).toBe("5.00");
  });

  test("without d, Intl's default formatting applies", () => {
    expect(fmtNum(null, 1234.5678)).toBe("1,234.568");
  });

  test("separators follow hass.locale.language", () => {
    const nl = hassWith({ locale: { language: "nl" } });
    expect(fmtNum(nl, 1234.5, 1)).toBe("1.234,5");
    const en = hassWith({ locale: { language: "en" } });
    expect(fmtNum(en, 1234.5, 1)).toBe("1,234.5");
  });

  test("legacy hass.language works when locale is absent", () => {
    expect(fmtNum(hassWith({ language: "nl" }), 1234.5, 1)).toBe("1.234,5");
  });

  test("an invalid language tag falls back to en instead of throwing", () => {
    const bad = hassWith({ locale: { language: "not a tag!!" } });
    expect(fmtNum(bad, 1234.5, 1)).toBe("1,234.5");
  });

  test("a non-finite value passes through as its string form", () => {
    expect(fmtNum(null, NaN)).toBe("NaN");
    expect(fmtNum(null, Infinity)).toBe("Infinity");
    expect(fmtNum(null, -Infinity)).toBe("-Infinity");
  });
});

describe("norm", () => {
  test("strips trailing slashes", () => {
    expect(norm("/lovelace/")).toBe("/lovelace");
    expect(norm("/a///")).toBe("/a");
  });

  test("leaves a clean path alone", () => {
    expect(norm("/lovelace/home")).toBe("/lovelace/home");
  });

  test("empty and root collapse to '/'", () => {
    expect(norm("")).toBe("/");
    expect(norm("/")).toBe("/");
  });
});

describe("snapToStep", () => {
  test("snaps to the nearest min + k*step", () => {
    expect(snapToStep(17, 5, 60, 5)).toBe(15);
    expect(snapToStep(18, 5, 60, 5)).toBe(20);
    expect(snapToStep(42, 0, 100, 1)).toBe(42);
  });

  test("clamps to [min,max] after snapping", () => {
    expect(snapToStep(3, 5, 60, 5)).toBe(5);
    expect(snapToStep(200, 5, 60, 5)).toBe(60);
  });

  test("respects an offset min (grid is min + k*step, not 0 + k*step)", () => {
    // min 5 / step 5 → allowed 5,10,15…; 7 snaps to 5, 8 snaps to 10.
    expect(snapToStep(7, 5, 60, 5)).toBe(5);
    expect(snapToStep(8, 5, 60, 5)).toBe(10);
  });

  test("trims binary-float dust", () => {
    expect(snapToStep(0.3, 0, 1, 0.1)).toBe(0.3);
  });

  test("a non-positive step falls back to 1", () => {
    expect(snapToStep(3.6, 0, 10, 0)).toBe(4);
  });
});

describe("brightnessPct", () => {
  test("off or missing → 0", () => {
    expect(brightnessPct(undefined)).toBe(0);
    expect(brightnessPct(null)).toBe(0);
    expect(brightnessPct(ent({ state: "off", attributes: {} }))).toBe(0);
    expect(brightnessPct(ent({ state: "unavailable", attributes: {} }))).toBe(
      0,
    );
  });

  test("on with brightness → rounded percentage of 255", () => {
    expect(
      brightnessPct(ent({ state: "on", attributes: { brightness: 128 } })),
    ).toBe(50);
    expect(
      brightnessPct(ent({ state: "on", attributes: { brightness: 255 } })),
    ).toBe(100);
    expect(
      brightnessPct(ent({ state: "on", attributes: { brightness: 1 } })),
    ).toBe(0);
  });

  test("on without a brightness attribute → 100 (on/off-only light)", () => {
    expect(brightnessPct(ent({ state: "on", attributes: {} }))).toBe(100);
  });
});

describe("debounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("suppresses the leading edge, fires on the trailing edge", () => {
    const calls: number[] = [];
    const d = debounce((v: number) => calls.push(v), 100);
    d(1);
    expect(calls).toEqual([]);
    jest.advanceTimersByTime(99);
    expect(calls).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(calls).toEqual([1]);
  });

  test("the last call within the window wins", () => {
    const calls: number[] = [];
    const d = debounce((v: number) => calls.push(v), 100);
    d(1);
    jest.advanceTimersByTime(50);
    d(2);
    jest.advanceTimersByTime(99);
    expect(calls).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(calls).toEqual([2]);
  });

  test("cancel() drops the pending call", () => {
    const calls: number[] = [];
    const d = debounce((v: number) => calls.push(v), 100);
    d(1);
    d.cancel();
    jest.advanceTimersByTime(500);
    expect(calls).toEqual([]);
  });

  test("flush() fires the pending call immediately, and only once", () => {
    const calls: number[] = [];
    const d = debounce((v: number) => calls.push(v), 100);
    d(1);
    d.flush();
    expect(calls).toEqual([1]);
    jest.advanceTimersByTime(500);
    expect(calls).toEqual([1]);
  });

  test("flush() with nothing pending is a no-op", () => {
    const calls: number[] = [];
    const d = debounce((v: number) => calls.push(v), 100);
    d.flush();
    expect(calls).toEqual([]);
  });

  test("a repeat of the last-fired value within ~0.8s is deduped", () => {
    const calls: number[] = [];
    const d = debounce((v: number) => calls.push(v), 100);
    d(5);
    jest.advanceTimersByTime(100);
    expect(calls).toEqual([5]);
    d(5);
    jest.advanceTimersByTime(100); // trailing fire skipped: same key, <800ms
    expect(calls).toEqual([5]);
    jest.advanceTimersByTime(800); // dedupe window expires
    d(5);
    jest.advanceTimersByTime(100);
    expect(calls).toEqual([5, 5]);
  });

  test("dedupe keys on the first argument only", () => {
    const calls: string[] = [];
    const d = debounce((_k: number, v: string) => calls.push(v), 100);
    d(5, "a");
    jest.advanceTimersByTime(100);
    d(5, "b"); // same first arg → skipped despite a different second arg
    jest.advanceTimersByTime(100);
    expect(calls).toEqual(["a"]);
  });

  test("flush() bypasses the dedupe so a release always commits", () => {
    const calls: number[] = [];
    const d = debounce((v: number) => calls.push(v), 100);
    d(5);
    jest.advanceTimersByTime(100);
    d(5);
    d.flush();
    expect(calls).toEqual([5, 5]);
  });
});

describe("pctFromX", () => {
  const track = (left: number, width: number): Element =>
    ({ getBoundingClientRect: () => ({ left, width }) }) as unknown as Element;

  test("maps clientX to a 0-100% position along the track", () => {
    expect(pctFromX(200, track(100, 200))).toBe(50);
    expect(pctFromX(100, track(100, 200))).toBe(0);
    expect(pctFromX(300, track(100, 200))).toBe(100);
  });

  test("clamps outside the track", () => {
    expect(pctFromX(0, track(100, 200))).toBe(0);
    expect(pctFromX(999, track(100, 200))).toBe(100);
  });

  test("a zero-width track collapses to 0 (clamp folds the non-finite ratio to lo)", () => {
    expect(pctFromX(150, track(100, 0))).toBe(0);
    expect(pctFromX(100, track(100, 0))).toBe(0); // 0/0 → NaN → 0
  });
});

describe("store", () => {
  test("get falls back and set no-ops when sessionStorage is missing", () => {
    // bun has no sessionStorage — the try/catch swallows the ReferenceError.
    expect(store.get("k", "fallback")).toBe("fallback");
    expect(() => store.set("k", { a: 1 })).not.toThrow();
  });
});

describe("isUnavail", () => {
  test("missing, unavailable and unknown states read unavailable", () => {
    expect(isUnavail(null)).toBe(true);
    expect(isUnavail(undefined)).toBe(true);
    expect(isUnavail(ent({ state: "unavailable" }))).toBe(true);
    expect(isUnavail(ent({ state: "unknown" }))).toBe(true);
  });

  test("a real state does not", () => {
    expect(isUnavail(ent({ state: "on" }))).toBe(false);
    expect(isUnavail(ent({ state: "0" }))).toBe(false);
  });
});

describe("cssUrl", () => {
  test('wraps a URL in url("…")', () => {
    expect(cssUrl("http://x/y.png")).toBe('url("http://x/y.png")');
  });

  test("encodes quotes so a URL can't break out of the CSS string", () => {
    expect(cssUrl('a"b')).toBe('url("a%22b")');
  });
});

describe("pickEntity", () => {
  test("prefers the curated entities list", () => {
    expect(pickEntity("light", ["light.a"], ["light.b"], "light.z")).toBe(
      "light.a",
    );
  });

  test("falls back to entitiesFallback, then the placeholder", () => {
    expect(pickEntity("light", ["switch.a"], ["light.b"], "light.z")).toBe(
      "light.b",
    );
    expect(pickEntity("light", [], [], "light.z")).toBe("light.z");
  });

  test("only ids in the requested domain count", () => {
    expect(pickEntity("sensor", ["light.a"], ["switch.b"], "sensor.z")).toBe(
      "sensor.z",
    );
  });
});

describe("fmtState", () => {
  test("uses hass.formatEntityState when present", () => {
    const hass = hassWith({
      formatEntityState: (st: HassEntity) => `pretty ${st.state}`,
    });
    expect(fmtState(hass, ent({ state: "on" }))).toBe("pretty on");
  });

  test("falls back to the raw state when the helper is missing or throws", () => {
    expect(fmtState(hassWith({}), ent({ state: "23.4" }))).toBe("23.4");
    const throwing = hassWith({
      formatEntityState: () => {
        throw new Error("boom");
      },
    });
    expect(fmtState(throwing, ent({ state: "on" }))).toBe("on");
  });

  test("no state object yields the empty string", () => {
    expect(fmtState(null, null)).toBe("");
  });
});
