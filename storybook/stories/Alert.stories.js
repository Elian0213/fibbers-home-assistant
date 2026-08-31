import { story } from "../src/story.js";
import { HASS, HASS_ALL_CLEAR } from "../src/hass.js";

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
