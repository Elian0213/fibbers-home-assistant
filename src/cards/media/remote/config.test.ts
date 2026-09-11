/* Unit tests for the pure config validator + normalisation helpers. The throw
 * messages are the card's public contract, so they're asserted verbatim. */
import { describe, expect, test } from "bun:test";

import {
  validateRemoteConfig,
  controlKind,
  sliderControlEntities,
  persistKey,
  type RemoteConfig,
  type RemoteDevice,
} from "./config";

describe("validateRemoteConfig", () => {
  test("legacy flat config normalises to a one-device list", () => {
    const cfg = { type: "custom:fibbers-remote", entity: "remote.tv" };
    const devices = validateRemoteConfig(cfg);
    expect(devices).toHaveLength(1);
    expect(devices[0].entity).toBe("remote.tv");
  });

  test("`devices:` passes through as the list", () => {
    const cfg = {
      type: "custom:fibbers-remote",
      devices: [{ entity: "remote.a" }, { media_player: "media_player.b" }],
    };
    const devices = validateRemoteConfig(cfg);
    expect(devices).toHaveLength(2);
  });

  test("empty `devices:` falls back to the flat config", () => {
    const cfg = {
      type: "custom:fibbers-remote",
      media_player: "media_player.spk",
      devices: [],
    };
    const devices = validateRemoteConfig(cfg);
    expect(devices).toHaveLength(1);
    expect(devices[0].media_player).toBe("media_player.spk");
  });

  test("device without entity or media_player throws with its index", () => {
    const cfg = {
      type: "custom:fibbers-remote",
      devices: [{ entity: "remote.a" }, { name: "orphan" }],
    };
    expect(() => validateRemoteConfig(cfg as RemoteConfig)).toThrow(
      "fibbers-remote: device[1] needs `entity` (a remote.*) or `media_player`",
    );
  });

  test("unknown `device:` throws", () => {
    const cfg = {
      type: "custom:fibbers-remote",
      entity: "remote.a",
      device: "roku",
    };
    expect(() => validateRemoteConfig(cfg as RemoteConfig)).toThrow(
      'fibbers-remote: `device` must be "appletv", "philips", "androidtv" or "generic"',
    );
  });

  test("`device: generic` without commands throws", () => {
    const cfg = {
      type: "custom:fibbers-remote",
      entity: "remote.a",
      device: "generic",
    };
    expect(() => validateRemoteConfig(cfg as RemoteConfig)).toThrow(
      "fibbers-remote: `device: generic` makes no command assumptions — provide a `commands:` map",
    );
  });

  test("`device: generic` with commands is accepted", () => {
    const cfg = {
      type: "custom:fibbers-remote",
      entity: "remote.a",
      device: "generic",
      commands: { ok: "OK" },
    };
    expect(() => validateRemoteConfig(cfg as RemoteConfig)).not.toThrow();
  });

  test("bad `dpad` throws", () => {
    const cfg = {
      type: "custom:fibbers-remote",
      entity: "remote.a",
      dpad: "joystick",
    };
    expect(() => validateRemoteConfig(cfg as RemoteConfig)).toThrow(
      "fibbers-remote: `dpad` must be",
    );
  });

  test("non-list, non-auto `sources` throws", () => {
    const cfg = {
      type: "custom:fibbers-remote",
      media_player: "media_player.a",
      sources: "netflix",
    };
    expect(() => validateRemoteConfig(cfg as RemoteConfig)).toThrow(
      'fibbers-remote: `sources` must be "auto" or a list',
    );
  });

  test("`sources`/`favourites` without media_player throws", () => {
    const cfg = {
      type: "custom:fibbers-remote",
      entity: "remote.a",
      sources: "auto",
    };
    expect(() => validateRemoteConfig(cfg as RemoteConfig)).toThrow(
      "fibbers-remote: `sources`/`favourites` need a `media_player:`",
    );
  });

  test("non-list `controls` throws with its index", () => {
    const cfg = {
      type: "custom:fibbers-remote",
      devices: [{ entity: "remote.a", controls: {} }],
    };
    expect(() => validateRemoteConfig(cfg as unknown as RemoteConfig)).toThrow(
      "fibbers-remote: device[0] `controls` must be a list",
    );
  });

  test("control without an entity throws with both indices", () => {
    const cfg = {
      type: "custom:fibbers-remote",
      devices: [{ entity: "remote.a", controls: [{ name: "nope" }] }],
    };
    expect(() => validateRemoteConfig(cfg as unknown as RemoteConfig)).toThrow(
      "fibbers-remote: device[0].controls[0] needs an `entity`",
    );
  });

  test("bad control type throws", () => {
    const cfg = {
      type: "custom:fibbers-remote",
      devices: [
        { entity: "remote.a", controls: [{ entity: "x.y", type: "dial" }] },
      ],
    };
    expect(() => validateRemoteConfig(cfg as RemoteConfig)).toThrow(
      "fibbers-remote: `controls[].type` must be one of",
    );
  });
});

describe("controlKind", () => {
  test("explicit type wins over the entity domain", () => {
    expect(controlKind({ entity: "light.x", type: "toggle" })).toBe("toggle");
  });

  test("falls back to the entity domain mapping", () => {
    expect(controlKind({ entity: "input_number.x" })).toBe("number");
    expect(controlKind({ entity: "switch.x" })).toBe("toggle");
    expect(controlKind({ entity: "scene.x" })).toBe("scene");
  });
});

describe("sliderControlEntities", () => {
  test("collects only light/number controls across devices", () => {
    const devices: RemoteDevice[] = [
      {
        entity: "remote.a",
        controls: [
          { entity: "light.lamp" },
          { entity: "switch.screen" },
          { entity: "number.sharpness" },
        ],
      },
      { media_player: "media_player.b", controls: [{ entity: "scene.movie" }] },
    ];
    const set = sliderControlEntities(devices);
    expect([...set].sort()).toEqual(["light.lamp", "number.sharpness"]);
  });

  test("honours an explicit type override", () => {
    const devices: RemoteDevice[] = [
      { entity: "remote.a", controls: [{ entity: "light.x", type: "toggle" }] },
    ];
    expect(sliderControlEntities(devices).size).toBe(0);
  });
});

describe("persistKey", () => {
  test("joins entity/media_player/name across devices", () => {
    const devices: RemoteDevice[] = [
      { entity: "remote.a" },
      { media_player: "media_player.b" },
      { name: "Speaker" },
    ];
    expect(persistKey(devices)).toBe(
      "fibbers:remote:remote.a|media_player.b|Speaker",
    );
  });
});
