/* ================================================================== *
 * light-detail-lamps — pure lamp accessors over `(hass, id)`.
 * No config, no state: read one lamp's state/attributes/derived colour. The
 * element's active-lamp shorthands are thin wrappers that pass `config.entity`.
 * ================================================================== */
import { clamp, isUnavail } from "@shared/util";
import type { HomeAssistant, HassEntity } from "@/types/home-assistant";

import { STRIP_LO, STRIP_HI } from "./light-detail-math";

export const COLOR_MODES = ["hs", "rgb", "rgbw", "rgbww", "xy"];

/** The lamp's state object, or undefined when hass/entity is missing. */
export function lampState(
  hass: HomeAssistant | undefined,
  id: string,
): HassEntity | undefined {
  return hass && hass.states[id];
}

/** True when the lamp exists and is on. */
export function lampOn(hass: HomeAssistant | undefined, id: string): boolean {
  const st = lampState(hass, id);
  return !!st && st.state === "on";
}

/** True when the lamp is missing or reads unavailable/unknown. */
export function lampUnavail(
  hass: HomeAssistant | undefined,
  id: string,
): boolean {
  return isUnavail(lampState(hass, id));
}

/** One attribute off the lamp's state (undefined when absent). */
export function lampAttr(
  hass: HomeAssistant | undefined,
  id: string,
  k: string,
): unknown {
  const st = lampState(hass, id);
  return st && st.attributes ? st.attributes[k] : undefined;
}

/** The lamp's supported_color_modes, or [] when none are reported. */
export function lampModes(
  hass: HomeAssistant | undefined,
  id: string,
): string[] {
  return (lampAttr(hass, id, "supported_color_modes") as string[]) || [];
}

/** True when the lamp supports a colour mode (hs/rgb/xy…). */
export function lampHasColor(
  hass: HomeAssistant | undefined,
  id: string,
): boolean {
  return lampModes(hass, id).some((m) => COLOR_MODES.includes(m));
}

/** True when the lamp supports colour-temperature (the warm→cool white range). */
export function lampHasTemp(
  hass: HomeAssistant | undefined,
  id: string,
): boolean {
  return lampModes(hass, id).includes("color_temp");
}

/** The lamp's hs_color, or [0,0] when it reports none. */
export function lampHs(
  hass: HomeAssistant | undefined,
  id: string,
): [number, number] {
  const hs = lampAttr(hass, id, "hs_color");
  return Array.isArray(hs) ? (hs as [number, number]) : [0, 0];
}

/** The lamp's [min,max] kelvin, defaulting to the strip and guarding hi>lo. */
export function lampKRange(
  hass: HomeAssistant | undefined,
  id: string,
): [number, number] {
  const lo = Number(lampAttr(hass, id, "min_color_temp_kelvin")) || STRIP_LO;
  const hi = Number(lampAttr(hass, id, "max_color_temp_kelvin")) || STRIP_HI;
  return [lo, hi > lo ? hi : lo + 1];
}

/** The lamp's current colour temperature in kelvin, or null when absent. */
export function lampKelvin(
  hass: HomeAssistant | undefined,
  id: string,
): number | null {
  const k = Number(lampAttr(hass, id, "color_temp_kelvin"));
  return Number.isFinite(k) ? k : null;
}

/**
 * The lamp's real rendered colour for a swatch/dot: HA's rgb_color when present
 * (faithful for colour AND warm lamps), else a warm-white for an on lamp with no
 * colour data (e.g. an hs-mode light reporting color_mode "onoff"), else neutral.
 */
export function swatchColor(
  hass: HomeAssistant | undefined,
  id: string,
): string {
  if (!lampOn(hass, id)) return "#3a4446";
  const rgb = lampAttr(hass, id, "rgb_color");
  if (Array.isArray(rgb)) return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  const hs = lampAttr(hass, id, "hs_color");
  if (Array.isArray(hs))
    return `hsl(${Math.round(hs[0])} ${Math.round(clamp(hs[1], 20, 90))}% 55%)`;
  return "#ffe6c2";
}
