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

/** Every light that's on — HA-localised state text as the secondary line. */
export const LightsOn = story(
  {
    type: "custom:fibbers-entities",
    title: "Lampen aan",
    icon: "solar:lightbulb-bold-duotone",
    filters: [{ domain: "light", state: "on" }],
    secondary: "state",
  },
  { hass: HASS },
);

/** Filter by an entity_id regex, showing brightness via `attribute:` secondary. */
export const AttributeSecondary = story(
  {
    type: "custom:fibbers-entities",
    title: "Spots",
    filters: [{ entity_id: "^light\\.spot_" }],
    secondary: "attribute:brightness",
  },
  { hass: HASS },
);

/** Scenes sorted by most-recent activation, capped at 4 with a relative "ago" line. */
export const RecentScenes = story(
  {
    type: "custom:fibbers-entities",
    title: "Recente scenes",
    icon: "solar:magic-stick-3-bold-duotone",
    filters: [{ domain: "scene" }],
    sort: "last_changed",
    max: 4,
    secondary: "last_changed",
  },
  { hass: HASS },
);

/** No title/icon — a bare row list of both people with their presence state. */
export const NoHeader = story(
  {
    type: "custom:fibbers-entities",
    filters: [{ domain: "person" }],
    secondary: "state",
  },
  { hass: HASS },
);
