import { story } from "../src/story.js";

export default {
  title: "Cards/Toggle",
  tags: ["autodocs"],
};

/** A switch row with a static secondary subline. */
export const Aan = story({
  type: "custom:fibbers-toggle",
  entity: "input_boolean.wake_radio_enabled",
  name: "Radio aan",
  icon: "solar:soundwave-bold-duotone",
  secondary: "Speelt NPO Radio 2",
});

/** Missing / unavailable entity. */
export const Unavailable = story({
  type: "custom:fibbers-toggle",
  entity: "input_boolean.does_not_exist",
  name: "Radio aan",
});
