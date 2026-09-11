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
} from "./device";

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
