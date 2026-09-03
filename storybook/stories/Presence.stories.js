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

/** One of two home — Elian's tile tints green and the summary counts them. */
export const IemandThuis = story(
  {
    type: "custom:fibbers-presence",
    people: ["person.elian", "person.chelsea"],
  },
  { hass: HASS_HOME },
);

/** Explicit single-person list — a focused tile with no home yet (away state). */
export const EnkelePersoon = story(
  {
    type: "custom:fibbers-presence",
    people: ["person.chelsea"],
  },
  { hass: HASS },
);

/** `title: false` drops the "Aanwezigheid" header, leaving only the count + tiles. */
export const ZonderTitel = story(
  {
    type: "custom:fibbers-presence",
    title: false,
    people: ["person.elian", "person.chelsea"],
  },
  { hass: HASS_HOME },
);
