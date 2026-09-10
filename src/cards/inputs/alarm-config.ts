/* ================================================================== *
 * ALARM CONFIG — the config surface shared by the fibbers-alarm tile and its
 * sheet body, plus the small HH:MM helpers both need. Kept in one place so the
 * two elements can't drift.
 * ================================================================== */
import type { LovelaceCardConfig } from "@/types/home-assistant";

/** YAML/editor config accepted by `fibbers-alarm` (and its internal sheet). */
export interface AlarmConfig extends LovelaceCardConfig {
  /** input_datetime (time-only) — the alarm time. The only required key. */
  time: string;
  enable?: string; // input_boolean master on/off
  light_start?: string; // input_datetime, derived, read-only
  duration?: string; // input_number, fade minutes
  brightness?: string; // input_number, end %
  days?: string; // input_select, day mode
  radio_enable?: string; // input_boolean, wake radio on/off
  station?: string; // input_select, radio station
  volume?: string; // input_number, wake volume
  status?: string; // input_text | sensor, last-run status
  lights?: string[]; // explicit wake-light list
  lights_label?: string; // resolve wake lights from an HA label
  config_path?: string; // navigation path for "full configuration"
  name?: string;
  icon?: string;
}

/**
 * Validate a shared alarm config: `time` is required, and `lights` /
 * `lights_label` are mutually exclusive. Throws with a `tag`-prefixed message so
 * the editor surfaces it. Called from both elements' setConfig.
 * @param config @param tag — the element name for the error message
 */
export function assertAlarmConfig(
  config: AlarmConfig | null | undefined,
  tag: string,
): void {
  if (!config || !config.time)
    throw new Error(`${tag}: \`time\` (an input_datetime) is required`);
  if (config.lights != null && config.lights_label != null)
    throw new Error(`${tag}: set \`lights\` or \`lights_label\`, not both`);
}

/**
 * A real HH:MM (zero-padded) from an input_datetime state ("09:00:00") — else ""
 * so "unavailable"/"unknown" renders as a dash, not garbage. Accepts a 1- or
 * 2-digit hour.
 * @param s
 */
export const hhmm = (s: string | null | undefined): string => {
  const m = typeof s === "string" && s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
};

/** Minutes since midnight from an HH:MM, or null. @param s */
const toMinutes = (s: string | null | undefined): number | null => {
  const t = hhmm(s);
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** HH:MM from minutes-since-midnight, wrapping across the day. @param mins */
const fromMinutes = (mins: number): string => {
  const total = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * Add `mins` (may be negative) to an HH:MM, wrapping across midnight — used for
 * "→ end" fade windows and the ± time stepper. "" when the input isn't a time.
 * @param s @param mins
 */
export const addMinutes = (
  s: string | null | undefined,
  mins: number,
): string => {
  const base = toMinutes(s);
  return base == null ? "" : fromMinutes(base + mins);
};

/**
 * Step an HH:MM by whole hours and/or minutes, each field wrapping independently
 * (23:00 +1h → 00:00; 09:59 +1m → 09:00) so the ± buttons never roll one field
 * into the other. "" when the input isn't a time.
 * @param s @param dHours @param dMinutes
 */
export const stepTime = (
  s: string | null | undefined,
  dHours: number,
  dMinutes: number,
): string => {
  const base = toMinutes(s);
  if (base == null) return "";
  let h = Math.floor(base / 60);
  let m = base % 60;
  h = (((h + dHours) % 24) + 24) % 24;
  m = (((m + dMinutes) % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
