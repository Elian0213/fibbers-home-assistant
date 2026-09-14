/* ================================================================== *
 * fibbers-remote — config shapes and the pure validation/normalisation the
 * element's `setConfig` delegates to. Kept side-effect-free so it's unit-tested
 * directly (config.test.ts) and never touches the live element.
 * ================================================================== */
import type { LovelaceCardConfig } from "@/types/home-assistant";
import {
  COMMANDS,
  DPAD_MODES,
  CONTROL_TYPE,
  CONTROL_TYPES,
  SLIDER_CONTROLS,
  type ChipItem,
} from "./const";
import type { TouchpadOptions } from "./touchpad-math";

/** A single extra entity surfaced in the optional `controls:` panel. */
export interface RemoteControl {
  entity: string;
  type?: string;
  name?: string;
  icon?: string;
}

/** One remote device: a remote entity and/or a media_player, plus per-device options. */
export interface RemoteDevice {
  entity?: string;
  media_player?: string;
  volume_entity?: string;
  name?: string;
  icon?: string;
  device?: string;
  commands?: Record<string, string>;
  dpad?: string;
  touchpad?: TouchpadOptions;
  sources?: "auto" | (string | ChipItem)[];
  favourites?: string[];
  controls?: RemoteControl[];
}

/** YAML/editor config accepted by `fibbers-remote`. */
export interface RemoteConfig extends LovelaceCardConfig, RemoteDevice {
  devices?: RemoteDevice[];
  remember?: boolean;
  auto_select?: string;
  debug?: boolean;
}

/**
 * Validate a raw config and normalise it into a device list — `devices:` if given,
 * else the legacy flat config as a single device. Throws on a bad device so the
 * editor surfaces it; the messages are the card's public contract.
 */
export function validateRemoteConfig(config: RemoteConfig): RemoteDevice[] {
  if (!config) throw new Error("fibbers-remote: config is required");
  // Normalise to a device list: `devices:` if given, else the legacy flat config
  // as a single device. A one-device card renders no switcher.
  const devices: RemoteDevice[] =
    Array.isArray(config.devices) && config.devices.length
      ? config.devices
      : [config];
  devices.forEach((d, i) => {
    if (!d || (!d.entity && !d.media_player)) {
      throw new Error(
        `fibbers-remote: device[${i}] needs \`entity\` (a remote.*) or \`media_player\``,
      );
    }
    if (d.volume_entity != null) {
      if (
        typeof d.volume_entity !== "string" ||
        !d.volume_entity.startsWith("media_player.")
      ) {
        throw new Error(
          `fibbers-remote: device[${i}] \`volume_entity\` must be a \`media_player.*\` — it drives media_player.volume_set / volume_mute`,
        );
      }
    }
    if (d.device != null && !COMMANDS[d.device]) {
      throw new Error(
        'fibbers-remote: `device` must be "appletv", "philips", "androidtv" or "generic"',
      );
    }
    if (d.device === "generic" && !d.commands) {
      throw new Error(
        "fibbers-remote: `device: generic` makes no command assumptions — provide a `commands:` map",
      );
    }
    if (d.dpad != null && !DPAD_MODES.includes(d.dpad)) {
      throw new Error(
        'fibbers-remote: `dpad` must be "swipe", "buttons", "both", "grid" or "touchpad"',
      );
    }
    if (d.touchpad != null) {
      if (typeof d.touchpad !== "object" || Array.isArray(d.touchpad)) {
        throw new Error(
          `fibbers-remote: device[${i}] \`touchpad\` must be an options map (edge_click, momentum, haptics, sensitivity, scrub, native_touch)`,
        );
      }
      const { sensitivity } = d.touchpad;
      if (
        sensitivity != null &&
        (typeof sensitivity !== "number" ||
          !Number.isFinite(sensitivity) ||
          sensitivity < 0.25 ||
          sensitivity > 4)
      ) {
        throw new Error(
          "fibbers-remote: `touchpad.sensitivity` must be a number between 0.25 and 4",
        );
      }
    }
    if (
      d.sources != null &&
      d.sources !== "auto" &&
      !Array.isArray(d.sources)
    ) {
      throw new Error('fibbers-remote: `sources` must be "auto" or a list');
    }
    if ((d.sources || d.favourites) && !d.media_player) {
      throw new Error(
        "fibbers-remote: `sources`/`favourites` need a `media_player:` — they call media_player.select_source",
      );
    }
    if (d.controls != null) {
      if (!Array.isArray(d.controls)) {
        throw new Error(
          `fibbers-remote: device[${i}] \`controls\` must be a list`,
        );
      }
      d.controls.forEach((c, j) => {
        if (!c || typeof c.entity !== "string") {
          throw new Error(
            `fibbers-remote: device[${i}].controls[${j}] needs an \`entity\``,
          );
        }
        if (c.type != null && !CONTROL_TYPES.includes(c.type)) {
          throw new Error(
            `fibbers-remote: \`controls[].type\` must be one of ${CONTROL_TYPES.join(", ")}`,
          );
        }
      });
    }
  });
  return devices;
}

/** The render kind for a control: explicit `type:` wins, else the entity domain. */
export function controlKind(c: RemoteControl): string {
  return c.type || CONTROL_TYPE[String(c.entity).split(".")[0]];
}

/** Entity ids across all devices whose control renders as a slider (light/number). */
export function sliderControlEntities(devices: RemoteDevice[]): Set<string> {
  const wanted = new Set<string>();
  for (const d of devices) {
    for (const c of d.controls || []) {
      if (SLIDER_CONTROLS.includes(controlKind(c))) wanted.add(c.entity);
    }
  }
  return wanted;
}

/** The storage key for the remembered device index, keyed on the device list. */
export function persistKey(devices: RemoteDevice[]): string {
  const ids = devices.map((d) => d.entity || d.media_player || d.name);
  return `fibbers:remote:${ids.join("|")}`;
}
