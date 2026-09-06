/* Unit tests for the pure service-call helpers in actions.ts. runAction is
 * DOM/navigation-bound and is exercised through the storybook stories instead. */
import { describe, expect, test } from "bun:test";

import type { HomeAssistant } from "@/types/home-assistant";
import { setLightBrightness } from "./actions";

type Call = [string, string, Record<string, unknown> | undefined];

const recorder = (): { calls: Call[]; hass: HomeAssistant } => {
  const calls: Call[] = [];
  const hass = {
    callService: (
      domain: string,
      service: string,
      data?: Record<string, unknown>,
    ) => {
      calls.push([domain, service, data]);
      return Promise.resolve();
    },
  } as unknown as HomeAssistant;
  return { calls, hass };
};

describe("setLightBrightness", () => {
  test("a positive pct turns on with brightness_pct", async () => {
    const { calls, hass } = recorder();
    await setLightBrightness(hass, "light.desk", 40);
    expect(calls).toEqual([
      ["light", "turn_on", { entity_id: "light.desk", brightness_pct: 40 }],
    ]);
  });

  test("pct <= 0 turns off instead of turn_on at 0%", async () => {
    const { calls, hass } = recorder();
    await setLightBrightness(hass, "light.desk", 0);
    expect(calls).toEqual([["light", "turn_off", { entity_id: "light.desk" }]]);
  });

  test("a member list passes through as the entity_id", async () => {
    const { calls, hass } = recorder();
    await setLightBrightness(hass, ["light.a", "light.b"], 75);
    expect(calls).toEqual([
      [
        "light",
        "turn_on",
        { entity_id: ["light.a", "light.b"], brightness_pct: 75 },
      ],
    ]);
  });

  test("missing hass or an empty target resolves as a no-op", async () => {
    const { calls, hass } = recorder();
    await setLightBrightness(null, "light.desk", 50);
    await setLightBrightness(hass, [], 50);
    await setLightBrightness(hass, "", 50);
    expect(calls).toEqual([]);
  });

  test("a rejected service call propagates to the caller's catch", async () => {
    const hass = {
      callService: () => Promise.reject(new Error("boom")),
    } as unknown as HomeAssistant;
    let caught = false;
    await setLightBrightness(hass, "light.desk", 50).catch(() => {
      caught = true;
    });
    expect(caught).toBe(true);
  });
});
