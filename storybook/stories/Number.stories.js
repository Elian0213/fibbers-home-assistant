import { story } from "../src/story.js";

export default {
  title: "Cards/Number",
  tags: ["autodocs"],
};

/** A drag slider bound to an input_number, across its min/max/step. */
export const Slider = story({
  type: "custom:fibbers-number",
  entity: "input_number.opkomst_duur",
  name: "Opkomst duur",
  icon: "solar:hourglass-bold-duotone",
});

/** The same helper as a −/+ stepper. */
export const Stepper = story({
  type: "custom:fibbers-number",
  entity: "input_number.opkomst_duur",
  name: "Opkomst duur",
  icon: "solar:hourglass-bold-duotone",
  mode: "stepper",
});

/** Missing / unavailable entity — muted, disabled track. */
export const Unavailable = story({
  type: "custom:fibbers-number",
  entity: "input_number.does_not_exist",
  name: "Opkomst duur",
});
