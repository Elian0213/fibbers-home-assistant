/* Unit tests for the i18n layer. Note: en.json and nl.json currently have full
 * key parity, so the "key present in en but missing in nl" fallback line is
 * unreachable with real keys — the catalog-level fallback (unknown language →
 * en) is covered instead. */
import { describe, expect, test } from "bun:test";

import { langOf, t } from "./i18n";

describe("langOf", () => {
  test("null/undefined resolve to en", () => {
    expect(langOf(null)).toBe("en");
    expect(langOf(undefined)).toBe("en");
  });

  test("a bare language string passes through untouched", () => {
    expect(langOf("de-CH")).toBe("de-CH");
    expect(langOf("nl")).toBe("nl");
  });

  test("a hass object resolves locale.language", () => {
    expect(langOf({ locale: { language: "nl" } })).toBe("nl");
  });

  test("legacy hass.language works, but locale.language wins", () => {
    expect(langOf({ language: "nl" })).toBe("nl");
    expect(langOf({ locale: { language: "nl" }, language: "en" })).toBe("nl");
  });

  test("an object with neither field resolves to en", () => {
    expect(langOf({})).toBe("en");
  });
});

describe("t — catalog resolution", () => {
  test("en is the default", () => {
    expect(t(undefined, "common.not_available")).toBe("Not available");
  });

  test("nl resolves the Dutch catalog", () => {
    expect(t("nl", "common.not_available")).toBe("Niet beschikbaar");
    expect(t({ locale: { language: "nl" } }, "light_row.on")).toBe("Aan");
  });

  test("a regional tag falls back to its base language catalog", () => {
    expect(t("nl-NL", "light_row.on")).toBe("Aan");
  });

  test("a language with no catalog falls back to English", () => {
    expect(t("de-CH", "light_row.on")).toBe("On");
    expect(t("fr", "common.not_available")).toBe("Not available");
  });

  test("a totally unknown key returns the key itself", () => {
    expect(t("en", "nope.missing")).toBe("nope.missing");
    expect(t("nl", "nope.missing")).toBe("nope.missing");
  });

  test("a key that dead-ends inside a string returns the key", () => {
    expect(t("en", "common.not_available.deeper")).toBe(
      "common.not_available.deeper",
    );
  });
});

describe("t — interpolation", () => {
  test("replaces {vars}", () => {
    expect(t("en", "greeting.lights_on", { on: 3, total: 7 })).toBe(
      "3 of 7 lights on",
    );
    expect(t("nl", "room.state_count", { on: 2, total: 5 })).toBe(
      "2 van 5 aan",
    );
  });

  test("a missing var stays verbatim in the string", () => {
    expect(t("en", "greeting.lights_on", { on: 3 })).toBe(
      "3 of {total} lights on",
    );
  });

  test("no vars at all leaves placeholders untouched", () => {
    expect(t("en", "common.show_all")).toBe("All {n}");
  });
});

describe("t — pluralisation", () => {
  test("count === 1 picks the <key>_one sibling", () => {
    expect(t("en", "alert.updates_available", { count: 1 })).toBe(
      "1 update available",
    );
    expect(t("nl", "alert.lights_offline", { count: 1 })).toBe("Lamp offline");
  });

  test("count !== 1 uses the base key", () => {
    expect(t("en", "alert.updates_available", { n: 4, count: 4 })).toBe(
      "4 updates available",
    );
    expect(t("nl", "alert.lights_offline", { count: 2 })).toBe(
      "Lampen offline",
    );
    expect(t("en", "alert.updates_available", { n: 0, count: 0 })).toBe(
      "0 updates available",
    );
  });

  test("a string count coerces — '1' still picks the _one form", () => {
    expect(t("en", "alert.updates_available", { count: "1" })).toBe(
      "1 update available",
    );
  });

  test("a key without a _one sibling just uses the base key", () => {
    expect(t("en", "presence.count_home", { n: 1, count: 1 })).toBe("1 home");
  });
});
