import { story } from "../src/story.js";

export default {
  title: "Cards/Datetime",
  tags: ["autodocs"],
};

/** A time-only helper, shown big like the scheduler's wake time. */
export const Tijd = story({
  type: "custom:fibbers-datetime",
  entity: "input_datetime.keuken_dag_start",
  name: "Dag begint om",
  icon: "solar:sunrise-bold-duotone",
});

/** A date-only helper, localised (not an ISO string). */
export const Datum = story({
  type: "custom:fibbers-datetime",
  entity: "input_datetime.vakantie_start",
  name: "Vakantie",
  icon: "solar:calendar-bold-duotone",
});

/** Missing / unavailable entity. */
export const Unavailable = story({
  type: "custom:fibbers-datetime",
  entity: "input_datetime.does_not_exist",
  name: "Vakantie",
});
