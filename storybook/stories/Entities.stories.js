import { story } from "../src/story.js";
import { HASS, HASS_BATT_LOW, HASS_ALL_CLEAR } from "../src/hass.js";

export default {
  title: "Cards/Entities",
  tags: ["autodocs"],
};

/** Everything unavailable — fills itself from hass, no hardcoded entity list. */
export const Onbereikbaar = story(
  {
    type: "custom:fibbers-entities",
    title: "Onbereikbaar",
    icon: "solar:danger-triangle-bold-duotone",
    filters: [{ domain: "light", state: ["unavailable", "unknown"] }],
    secondary: "state",
  },
  { hass: HASS },
);

/** Any battery under 30% — a numeric threshold on a device_class. */
export const LowBattery = story(
  {
    type: "custom:fibbers-entities",
    title: "Batterij laag",
    filters: [{ attributes: { device_class: "battery" }, below: 30 }],
    secondary: "state",
  },
  { hass: HASS_BATT_LOW },
);

/** Nothing matches — the optional `empty` line shows a green all-clear. */
export const AllClear = story(
  {
    type: "custom:fibbers-entities",
    title: "Onbereikbaar",
    filters: [{ domain: "light", state: ["unavailable", "unknown"] }],
    empty: "Alles bereikbaar",
  },
  { hass: HASS_ALL_CLEAR },
);
