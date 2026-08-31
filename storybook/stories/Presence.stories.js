import { story } from "../src/story.js";
import { HASS, HASS_HOME } from "../src/hass.js";

export default {
  title: "Cards/Presence",
  tags: ["autodocs"],
};

/** No `people` given — auto-collects every `person.*`. Nobody home → muted summary. */
export const NiemandThuis = story(
  { type: "custom:fibbers-presence" },
  { hass: HASS },
);

/** One person home — their tile tints green and the summary counts them. */
export const IemandThuis = story(
  {
    type: "custom:fibbers-presence",
    people: ["person.elian", "person.chelsea"],
  },
  { hass: HASS_HOME },
);
