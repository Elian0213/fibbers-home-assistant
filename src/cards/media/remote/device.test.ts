/* Unit tests for the pure device accessors — command resolution, kind detection,
 * feature bits, and source/favourite lists over a mock hass. */
import { describe, expect, test } from "bun:test";

import type { HomeAssistant, HassEntity } from "@/types/home-assistant";

import {
  deviceKind,
  deviceIcon,
  cmdFor,
  isDeviceOn,
  deviceUnavail,
  mpSupports,
  allSources,
  favSources,
  volumeEntityId,
  volumeDelegated,
  powerPlan,
  RECONNECT_TIMEOUT_MS,
  type PowerStep,
} from "./device";
import type { RemoteDevice } from "./config";

const platform = new Map<string, string>([
  ["remote.tv", "apple_tv"],
  ["remote.droid", "androidtv_remote"],
]);

describe("deviceKind", () => {
  test("explicit `device:` wins over platform detection", () => {
    expect(
      deviceKind({ entity: "remote.tv", device: "philips" }, platform),
    ).toBe("philips");
  });

  test("resolves from the platform map (apple_tv → appletv)", () => {
    expect(deviceKind({ entity: "remote.tv" }, platform)).toBe("appletv");
  });

  test("androidtv_remote platform maps to androidtv", () => {
    expect(deviceKind({ entity: "remote.droid" }, platform)).toBe("androidtv");
  });

  test("unknown platform / no entity falls back to generic", () => {
    expect(deviceKind({ entity: "remote.unknown" }, platform)).toBe("generic");
    expect(deviceKind({ media_player: "media_player.x" }, platform)).toBe(
      "generic",
    );
  });
});

describe("deviceIcon", () => {
  test("explicit icon wins", () => {
    expect(
      deviceIcon({ entity: "remote.tv", icon: "mdi:cast" }, "appletv"),
    ).toBe("mdi:cast");
  });

  test("a media_player-only device (no remote) is a speaker", () => {
    expect(deviceIcon({ media_player: "media_player.x" }, "generic")).toBe(
      "solar:smart-speaker-bold-duotone",
    );
  });

  test("a TV kind gets the tv icon, generic gets the gamepad", () => {
    expect(deviceIcon({ entity: "remote.tv" }, "appletv")).toBe(
      "solar:tv-bold-duotone",
    );
    expect(deviceIcon({ entity: "remote.x" }, "generic")).toBe(
      "solar:gamepad-bold-duotone",
    );
  });
});

describe("cmdFor", () => {
  test("per-key `commands:` override beats the map", () => {
    expect(cmdFor({ commands: { ok: "CUSTOM" } }, "appletv", "ok")).toBe(
      "CUSTOM",
    );
  });

  test("falls back to the kind's command map", () => {
    expect(cmdFor({}, "appletv", "ok")).toBe("select");
    expect(cmdFor({}, "philips", "up")).toBe("CursorUp");
  });

  test("unknown key or kind → undefined", () => {
    expect(cmdFor({}, "appletv", "channel_up")).toBeUndefined();
    expect(cmdFor({}, "roku", "ok")).toBeUndefined();
  });
});

describe("isDeviceOn", () => {
  const hass = {
    states: {
      "remote.on": { state: "on", attributes: {} },
      "remote.standby": { state: "standby", attributes: {} },
      "remote.unknown": { state: "unknown", attributes: {} },
      "media_player.playing": { state: "playing", attributes: {} },
    },
  } as unknown as HomeAssistant;

  test("on → true, standby/unknown → false", () => {
    expect(isDeviceOn(hass, { entity: "remote.on" })).toBe(true);
    expect(isDeviceOn(hass, { entity: "remote.standby" })).toBe(false);
    expect(isDeviceOn(hass, { entity: "remote.unknown" })).toBe(false);
  });

  test("falls through to the media_player when there is no remote", () => {
    expect(isDeviceOn(hass, { media_player: "media_player.playing" })).toBe(
      true,
    );
  });

  test("missing entity → false", () => {
    expect(isDeviceOn(hass, { entity: "remote.absent" })).toBe(false);
    expect(isDeviceOn(undefined, { entity: "remote.on" })).toBe(false);
  });

  test("the media_player wins over a connected-but-asleep Apple TV remote", () => {
    const h = {
      states: {
        "remote.atv": { state: "on", attributes: {} },
        "media_player.atv": { state: "off", attributes: {} },
      },
    } as unknown as HomeAssistant;
    expect(
      isDeviceOn(h, { entity: "remote.atv", media_player: "media_player.atv" }),
    ).toBe(false);
  });
});

describe("powerPlan", () => {
  const ATV: RemoteDevice = {
    device: "appletv",
    entity: "remote.living_room",
    media_player: "media_player.living_room",
  };
  const TV: RemoteDevice = {
    device: "philips",
    entity: "remote.tv",
    media_player: "media_player.tv",
  };
  const kindOf = (d: RemoteDevice): string => d.device || "generic";
  const mk = (s: Record<string, string>): HomeAssistant =>
    ({
      states: Object.fromEntries(
        Object.entries(s).map(([k, state]) => [k, { state, attributes: {} }]),
      ),
    }) as unknown as HomeAssistant;
  const plan = (h: HomeAssistant, d: RemoteDevice) =>
    powerPlan(h, d, kindOf(d), [TV, ATV], kindOf);
  const svc = (domain: string, service: string, entity: string): PowerStep => ({
    kind: "call",
    domain,
    service,
    entity,
  });
  const wait = (entity: string): PowerStep => ({
    kind: "wait_on",
    entity,
    timeoutMs: RECONNECT_TIMEOUT_MS,
  });

  test("asleep Apple TV, HA connected → media_player.turn_on (the iOS wake)", () => {
    const h = mk({
      "remote.living_room": "on",
      "media_player.living_room": "off",
    });
    expect(plan(h, ATV)).toEqual([
      svc("media_player", "turn_on", "media_player.living_room"),
    ]);
  });

  test("HA disconnected → reconnect, wait, then wake", () => {
    const h = mk({
      "remote.living_room": "off",
      "media_player.living_room": "off",
    });
    expect(plan(h, ATV)).toEqual([
      svc("remote", "turn_on", "remote.living_room"),
      wait("remote.living_room"),
      svc("media_player", "turn_on", "media_player.living_room"),
    ]);
  });

  test("awake Apple TV → media_player.turn_off, never remote.turn_off", () => {
    const h = mk({
      "remote.living_room": "on",
      "media_player.living_room": "playing",
    });
    expect(plan(h, ATV)).toEqual([
      svc("media_player", "turn_off", "media_player.living_room"),
    ]);
  });

  test("Philips follows its media_player state", () => {
    expect(plan(mk({ "media_player.tv": "standby" }), TV)).toEqual([
      svc("media_player", "turn_on", "media_player.tv"),
    ]);
    expect(plan(mk({ "media_player.tv": "on" }), TV)).toEqual([
      svc("media_player", "turn_off", "media_player.tv"),
    ]);
  });

  test("power_on pointing at the Apple TV wakes it the Apple TV way", () => {
    const tv = { ...TV, power_on: "media_player.living_room" };
    const h = mk({
      "media_player.tv": "standby",
      "remote.living_room": "off",
      "media_player.living_room": "off",
    });
    expect(plan(h, tv)).toEqual([
      svc("remote", "turn_on", "remote.living_room"),
      wait("remote.living_room"),
      svc("media_player", "turn_on", "media_player.living_room"),
    ]);
  });

  test("power_on only applies while off; power_off overrides while on", () => {
    const tv = {
      ...TV,
      power_on: "media_player.living_room",
      power_off: "switch.tv_plug",
    };
    expect(plan(mk({ "media_player.tv": "on" }), tv)).toEqual([
      svc("switch", "turn_off", "switch.tv_plug"),
    ]);
  });

  test("an action override runs as-is", () => {
    const action = { action: "perform-action", perform_action: "script.tv_on" };
    expect(
      plan(mk({ "media_player.tv": "off" }), { ...TV, power_on: action }),
    ).toEqual([{ kind: "action", action }]);
  });

  test("other platforms send the power key", () => {
    const droid = { device: "androidtv", entity: "remote.droid" };
    expect(plan(mk({ "remote.droid": "on" }), droid)).toEqual([
      { kind: "key" },
    ]);
  });
});

describe("deviceUnavail", () => {
  const hass = {
    states: {
      "remote.ok": { state: "on", attributes: {} },
      "remote.gone": { state: "unavailable", attributes: {} },
    },
  } as unknown as HomeAssistant;

  test("prefers the remote entity, reports unavailable", () => {
    expect(deviceUnavail(hass, { entity: "remote.gone" })).toBe(true);
    expect(deviceUnavail(hass, { entity: "remote.ok" })).toBe(false);
  });
});

describe("mpSupports", () => {
  // PAUSE (1) | PREV (16) | PLAY (16384) = 16401
  const mp = {
    attributes: { supported_features: 16401 },
  } as unknown as HassEntity;
  test("matches only the advertised bits", () => {
    expect(mpSupports(mp, 1)).toBe(true);
    expect(mpSupports(mp, 16)).toBe(true);
    expect(mpSupports(mp, 16384)).toBe(true);
    expect(mpSupports(mp, 32)).toBe(false);
    expect(mpSupports(null, 1)).toBe(false);
  });
});

describe("allSources", () => {
  test("`auto` maps the player's source_list", () => {
    const mp = {
      attributes: { source_list: ["HDMI1", "Netflix"] },
    } as unknown as HassEntity;
    expect(allSources({ sources: "auto" }, mp)).toEqual([
      { name: "HDMI1", source: "HDMI1" },
      { name: "Netflix", source: "Netflix" },
    ]);
  });

  test("a configured list mixes strings and chip items", () => {
    expect(
      allSources(
        { sources: ["Netflix", { name: "YT", source: "YouTube" }] },
        null,
      ),
    ).toEqual([
      { name: "Netflix", source: "Netflix" },
      { name: "YT", source: "YouTube" },
    ]);
  });

  test("no sources → empty", () => {
    expect(allSources({}, null)).toEqual([]);
  });
});

describe("volumeEntityId", () => {
  test("falls back to the device's own media_player", () => {
    expect(volumeEntityId({ media_player: "media_player.atv" })).toBe(
      "media_player.atv",
    );
  });

  test("prefers an explicit volume_entity", () => {
    expect(
      volumeEntityId({
        media_player: "media_player.atv",
        volume_entity: "media_player.tv",
      }),
    ).toBe("media_player.tv");
  });

  test("a remote-only device has no volume player", () => {
    expect(volumeEntityId({ entity: "remote.atv" })).toBeUndefined();
  });
});

describe("volumeDelegated", () => {
  test("true only when volume_entity differs from media_player", () => {
    expect(
      volumeDelegated({
        media_player: "media_player.atv",
        volume_entity: "media_player.tv",
      }),
    ).toBe(true);
  });

  test("false when the two ids are equal", () => {
    expect(
      volumeDelegated({
        media_player: "media_player.atv",
        volume_entity: "media_player.atv",
      }),
    ).toBe(false);
  });

  test("false when volume_entity is absent", () => {
    expect(volumeDelegated({ media_player: "media_player.atv" })).toBe(false);
  });
});

describe("favSources", () => {
  const all = [
    { name: "Netflix", source: "Netflix" },
    { name: "YT", source: "YouTube" },
  ];
  test("maps favourites in order, passing through unknown ones", () => {
    expect(favSources(["YouTube", "Spotify"], all)).toEqual([
      { name: "YT", source: "YouTube" },
      { name: "Spotify", source: "Spotify" },
    ]);
  });

  test("no favourites → null", () => {
    expect(favSources(undefined, all)).toBeNull();
    expect(favSources([], all)).toBeNull();
  });
});
