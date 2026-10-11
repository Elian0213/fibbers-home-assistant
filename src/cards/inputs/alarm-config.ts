/* ================================================================== *
 * ALARM CONFIG — the config surface shared by the fibbers-alarm tile and its
 * sheet body. Kept in one place so the two elements can't drift; the HH:MM
 * helpers they both use live in @shared/time.
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
