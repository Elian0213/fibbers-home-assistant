/* ================================================================== *
 * fibbers-remote — pure device accessors over (hass, device): the resolved
 * command family, icon, on/off state, per-key command string, supported-features
 * bits, and the source/favourite chip lists. No element state, so unit-testable.
 * ================================================================== */
import { isUnavail } from "@shared/util";
import type { HomeAssistant, HassEntity } from "@/types/home-assistant";

import {
  COMMANDS,
  PLATFORM_DEVICE,
  DEVICE_ICON,
  SPEAKER_ICON,
  OFF_STATES,
} from "./const";
import type { ChipItem } from "./const";
import type { RemoteDevice } from "./config";

/** The device's command family: explicit `device:` wins, else the resolved platform, else generic. */
export function deviceKind(
  d: RemoteDevice,
  platform: Map<string, string>,
): string {
  return (
    d.device ||
    (d.entity ? PLATFORM_DEVICE[platform.get(d.entity) || ""] : "") ||
    "generic"
  );
}

/** The device's icon: explicit `icon:` wins, else a TV/gamepad by kind, else a speaker. */
export function deviceIcon(d: RemoteDevice, kind: string): string {
  if (d.icon) return d.icon;
  if (!d.entity) return SPEAKER_ICON;
  return DEVICE_ICON[kind] || DEVICE_ICON.generic;
}

/** The command string for a logical key: `commands:` override, else the kind's map (undefined = can't). */
export function cmdFor(
  d: RemoteDevice,
  kind: string,
  key: string,
): string | undefined {
  const override = (d.commands || {})[key];
  if (override != null) return override;
  return (COMMANDS[kind] || {})[key];
}

/** True when the device's remote or media_player reports a non-off state. */
export function isDeviceOn(
  hass: HomeAssistant | undefined,
  d: RemoteDevice,
): boolean {
  const st =
    (d.entity && hass && hass.states[d.entity]) ||
    (d.media_player && hass && hass.states[d.media_player]);
  return st ? !OFF_STATES.includes(st.state) : false;
}

/** True when the device's primary entity (remote if present, else media_player) is unavailable. */
export function deviceUnavail(
  hass: HomeAssistant | undefined,
  d: RemoteDevice,
): boolean {
  const id = d.entity || d.media_player;
  const st = (id && hass && hass.states[id]) || null;
  return isUnavail(st);
}

/** True when a media_player advertises a supported_features bit. */
export function mpSupports(mp: HassEntity | null, bit: number): boolean {
  // eslint-disable-next-line no-bitwise -- supported_features is a bitmask
  return (((mp && mp.attributes.supported_features) || 0) & bit) === bit;
}

/** All source chips for a device: the player's `source_list` when `auto`, else the configured list. */
export function allSources(d: RemoteDevice, mp: HassEntity | null): ChipItem[] {
  if (!d.sources) return [];
  return d.sources === "auto"
    ? ((mp && mp.attributes.source_list) || []).map((s: string) => ({
        name: s,
        source: s,
      }))
    : d.sources.map((s) =>
        typeof s === "string" ? { name: s, source: s } : s,
      );
}

/** The favourite subset of sources (in `favourites:` order), or null when none configured. */
export function favSources(
  favourites: string[] | undefined,
  all: ChipItem[],
): ChipItem[] | null {
  if (!Array.isArray(favourites) || !favourites.length) return null;
  const byValue = new Map(all.map((s) => [s.source || s.name, s]));
  return favourites.map((f) => byValue.get(f) || { name: f, source: f });
}
