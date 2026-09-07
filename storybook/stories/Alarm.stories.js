import { story } from "../src/story.js";
import { makeHass } from "../src/hass.js";

export default {
  title: "Cards/Alarm",
  tags: ["autodocs"],
};

// The full drop-in config (mirrors the live dashboard).
const ALARM = {
  type: "custom:fibbers-alarm",
  name: "Wekker",
  icon: "solar:alarm-bold-duotone",
  enable: "input_boolean.wake_alarm_enabled",
  time: "input_datetime.wake_up_time",
  light_start: "input_datetime.wake_fade_start",
  duration: "input_number.wake_fade",
  brightness: "input_number.wake_brightness",
  days: "input_select.wake_days",
  radio_enable: "input_boolean.wake_radio_enabled",
  station: "input_select.wake_radio_station",
  volume: "input_number.wake_volume",
  status: "input_text.wake_status",
  config_path: "/dashboard-main/wekker",
  language: "nl",
};

// A hass with specific states patched onto a fresh mock.
const hassWith = (overrides) => {
  const h = makeHass();
  for (const [id, patch] of Object.entries(overrides)) {
    if (!h.states[id]) h.states[id] = { entity_id: id, state: "", attributes: {} };
    Object.assign(
      h.states[id],
      typeof patch === "string" ? { state: patch } : patch,
    );
  }
  return h;
};

/** The whole alarm at a glance: time, day mode, fade start, light + radio
 * summaries and the last-run status, with the master toggle armed. Tap opens the
 * settings sheet. */
export const Armed = story(ALARM);

/** Disarmed — the tile drops into its off treatment, the next-occurrence reads
 * "Uit" and the summaries dim; the toggle stays live. */
export const Disarmed = story(ALARM, {
  hass: hassWith({ "input_boolean.wake_alarm_enabled": "off" }),
});

/** Wake radio off — the radio summary reads "Radio uit". */
export const RadioOff = story(ALARM, {
  hass: hassWith({ "input_boolean.wake_radio_enabled": "off" }),
});

/** No radio entities configured — the radio summary is absent entirely. */
export const NoRadio = story({
  type: "custom:fibbers-alarm",
  name: "Wekker",
  enable: "input_boolean.wake_alarm_enabled",
  time: "input_datetime.wake_up_time",
  light_start: "input_datetime.wake_fade_start",
  duration: "input_number.wake_fade",
  brightness: "input_number.wake_brightness",
  days: "input_select.wake_days",
  language: "nl",
});

/** An unavailable time entity — the big time falls back to "—" and the next
 * occurrence can't be computed. */
export const Unavailable = story(ALARM, {
  hass: hassWith({ "input_datetime.wake_up_time": "unavailable" }),
});

/** No reachable wake lamp — the exact state that makes the alarm silently fail,
 * flagged in the warning colour in place of the light summary. */
export const NoReachableLight = story({
  ...ALARM,
  lights: ["light.slaapkamer_defect"],
});

/** A `FOUT` status from the light automation — the status line turns amber. */
export const FoutStatus = story(ALARM, {
  hass: hassWith({
    "input_text.wake_status": "FOUT: geen enkele lamp bereikbaar om 08:40",
  }),
});

/** The settings sheet body: master toggle, ± time stepper, day chips, and the
 * wake-radio block (on/off, station list, volume). */
export const SheetArmed = story({ ...ALARM, type: "custom:fibbers-alarm-sheet" });

/** The sheet with wake radio off — the station list and volume are disabled and
 * dimmed (not hidden, so the sheet doesn't jump height on toggle). */
export const SheetRadioOff = story(
  { ...ALARM, type: "custom:fibbers-alarm-sheet" },
  { hass: hassWith({ "input_boolean.wake_radio_enabled": "off" }) },
);
