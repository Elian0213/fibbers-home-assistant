import { story } from "../src/story.js";
import { HASS, HASS_ALL_CLEAR, HASS_BATT_LOW } from "../src/hass.js";

export default {
  title: "Cards/Alert",
  tags: ["autodocs"],
};

const CHECKS = {
  type: "custom:fibbers-alert",
  checks: [
    { type: "unavailable_lights" },
    { type: "low_battery", below: 20 },
    { type: "updates" },
  ],
};

/** Checks firing — amber "Aandacht nodig" tint, one tappable line per finding. */
export const Findings = story(CHECKS, { hass: HASS });

/** Everything clear — neutral card with a green tick and "Alles in orde". */
export const AllesInOrde = story(CHECKS, { hass: HASS_ALL_CLEAR });

/** Only the offline-lights check — two unavailable Hue bulbs rolled into one line. */
export const OfflineLights = story(
  { type: "custom:fibbers-alert", checks: [{ type: "unavailable_lights" }] },
  { hass: HASS },
);

/** Low-battery check alone — the motion sensor at 8% trips the 20% threshold. */
export const LowBattery = story(
  {
    type: "custom:fibbers-alert",
    checks: [{ type: "low_battery", below: 20 }],
  },
  { hass: HASS_BATT_LOW },
);

/** Updates check alone — one pending Home Assistant Core update. */
export const Updates = story(
  { type: "custom:fibbers-alert", checks: [{ type: "updates" }] },
  { hass: HASS },
);

/** exclude_pattern silences the offline Hue bulbs, so the same hass reads all-clear. */
export const Excluded = story(
  {
    type: "custom:fibbers-alert",
    checks: [{ type: "unavailable_lights", exclude_pattern: "hue" }],
  },
  { hass: HASS },
);
