/* Unit tests for the pure filter logic behind fibbers-entities. The Lit card
 * itself (entities.ts) needs a DOM and is exercised through storybook. */
import { describe, expect, test } from "bun:test";

import type { HassEntity } from "@/types/home-assistant";
import { compileFilters, matches, type EntityFilter } from "./entities-filter";

/** A minimal state object shaped like hass.states[id]. */
const ent = (
  entity_id: string,
  state: string,
  extra: { attributes?: Record<string, unknown>; last_changed?: string } = {},
): HassEntity =>
  ({
    entity_id,
    state,
    attributes: extra.attributes || {},
    last_changed: extra.last_changed || new Date().toISOString(),
  }) as unknown as HassEntity;

const hoursAgo = (h: number): string =>
  new Date(Date.now() - h * 3600e3).toISOString();

describe("compileFilters", () => {
  test("a valid entity_id regex compiles onto _re", () => {
    const [f] = compileFilters([{ entity_id: "^light\\." }], "filter");
    expect(f._re).toBeInstanceOf(RegExp);
    expect(f._re!.test("light.kitchen")).toBe(true);
    expect(f._re!.test("switch.kitchen")).toBe(false);
  });

  test("compiling does not mutate the input filter", () => {
    const input: EntityFilter = { entity_id: "^light\\." };
    compileFilters([input], "filter");
    expect(input._re).toBeUndefined();
  });

  test("a filter without entity_id passes through as the same object", () => {
    const input: EntityFilter = { domain: "light" };
    const [out] = compileFilters([input], "filter");
    expect(out).toBe(input);
    expect(out._re).toBeUndefined();
  });

  test("an invalid regex throws with the list label in the message", () => {
    expect(() => compileFilters([{ entity_id: "(" }], "exclude")).toThrow(
      /invalid exclude entity_id regex "\("/,
    );
    expect(() => compileFilters([{ entity_id: "[" }], "filter")).toThrow(
      /filter/,
    );
  });

  test("undefined filters compile to an empty list", () => {
    expect(compileFilters(undefined, "filter")).toEqual([]);
  });
});

describe("matches — gates", () => {
  test("an empty filter matches anything", () => {
    expect(matches(ent("light.a", "on"), {})).toBe(true);
  });

  test("domain gates on the entity_id prefix", () => {
    const f: EntityFilter = { domain: "light" };
    expect(matches(ent("light.a", "on"), f)).toBe(true);
    expect(matches(ent("switch.a", "on"), f)).toBe(false);
    expect(matches(ent("lightning.a", "on"), f)).toBe(false); // needs the dot
  });

  test("a compiled regex gates on entity_id", () => {
    const [f] = compileFilters([{ entity_id: "kitchen" }], "filter");
    expect(matches(ent("light.kitchen_spots", "on"), f)).toBe(true);
    expect(matches(ent("light.hall", "on"), f)).toBe(false);
  });

  test("gates AND together", () => {
    const f: EntityFilter = { domain: "light", state: "on" };
    expect(matches(ent("light.a", "on"), f)).toBe(true);
    expect(matches(ent("light.a", "off"), f)).toBe(false);
    expect(matches(ent("switch.a", "on"), f)).toBe(false);
  });
});

describe("matches — state", () => {
  test("state matches a single value with string coercion", () => {
    expect(matches(ent("sensor.t", "21"), { state: 21 })).toBe(true);
    expect(matches(ent("sensor.t", "21"), { state: "21" })).toBe(true);
    expect(matches(ent("sensor.t", "22"), { state: 21 })).toBe(false);
  });

  test("state matches any value of an array", () => {
    const f: EntityFilter = { state: ["unavailable", "unknown"] };
    expect(matches(ent("light.a", "unavailable"), f)).toBe(true);
    expect(matches(ent("light.a", "unknown"), f)).toBe(true);
    expect(matches(ent("light.a", "on"), f)).toBe(false);
  });

  test("state_not rejects a single value", () => {
    expect(matches(ent("light.a", "off"), { state_not: "off" })).toBe(false);
    expect(matches(ent("light.a", "on"), { state_not: "off" })).toBe(true);
  });

  test("state_not rejects every value of an array", () => {
    const f: EntityFilter = { state_not: ["off", "unavailable"] };
    expect(matches(ent("light.a", "off"), f)).toBe(false);
    expect(matches(ent("light.a", "unavailable"), f)).toBe(false);
    expect(matches(ent("light.a", "on"), f)).toBe(true);
  });
});

describe("matches — attributes", () => {
  test("attribute equality coerces both sides to strings", () => {
    const st = ent("sensor.b", "20", {
      attributes: { device_class: "battery", battery_level: 20 },
    });
    expect(matches(st, { attributes: { device_class: "battery" } })).toBe(true);
    expect(matches(st, { attributes: { battery_level: "20" } })).toBe(true);
    expect(matches(st, { attributes: { battery_level: 21 } })).toBe(false);
  });

  test("a missing attribute never equals a real value", () => {
    expect(
      matches(ent("sensor.b", "20"), { attributes: { device_class: "x" } }),
    ).toBe(false);
  });

  test("all listed attributes must match", () => {
    const st = ent("sensor.b", "20", {
      attributes: { device_class: "battery", unit_of_measurement: "%" },
    });
    expect(
      matches(st, {
        attributes: { device_class: "battery", unit_of_measurement: "%" },
      }),
    ).toBe(true);
    expect(
      matches(st, {
        attributes: { device_class: "battery", unit_of_measurement: "W" },
      }),
    ).toBe(false);
  });
});

describe("matches — thresholds", () => {
  test("below is a strict <", () => {
    expect(matches(ent("sensor.b", "15"), { below: 20 })).toBe(true);
    expect(matches(ent("sensor.b", "20"), { below: 20 })).toBe(false);
    expect(matches(ent("sensor.b", "25"), { below: 20 })).toBe(false);
  });

  test("above is a strict >", () => {
    expect(matches(ent("sensor.b", "25"), { above: 20 })).toBe(true);
    expect(matches(ent("sensor.b", "20"), { above: 20 })).toBe(false);
  });

  test("a locale comma decimal parses", () => {
    expect(matches(ent("sensor.b", "19,5"), { below: 20 })).toBe(true);
    expect(matches(ent("sensor.b", "20,5"), { below: 20 })).toBe(false);
  });

  test("a non-numeric state never passes a threshold", () => {
    expect(matches(ent("light.a", "on"), { below: 20 })).toBe(false);
    expect(matches(ent("light.a", "on"), { above: 0 })).toBe(false);
  });
});

describe("matches — stale_hours", () => {
  test("only a state older than the window matches", () => {
    const f: EntityFilter = { stale_hours: 2 };
    expect(
      matches(ent("sensor.a", "20", { last_changed: hoursAgo(3) }), f),
    ).toBe(true);
    expect(
      matches(ent("sensor.a", "20", { last_changed: hoursAgo(1) }), f),
    ).toBe(false);
  });

  test("an unparsable last_changed never reads stale", () => {
    expect(
      matches(ent("sensor.a", "20", { last_changed: "not-a-date" }), {
        stale_hours: 1,
      }),
    ).toBe(false);
  });
});
