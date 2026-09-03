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

/** Time-only, falling back to the entity's own icon and friendly name. */
export const Wektijd = story({
  type: "custom:fibbers-datetime",
  entity: "input_datetime.wake_time",
});

/** A date-only helper, localised (not an ISO string). */
export const Datum = story({
  type: "custom:fibbers-datetime",
  entity: "input_datetime.vakantie_start",
  name: "Vakantie",
  icon: "solar:calendar-bold-duotone",
});

/** Both has_date and has_time — the combined date+time value, localised. */
export const DatumTijd = story({
  type: "custom:fibbers-datetime",
  entity: "input_datetime.vergadering",
  name: "Vergadering",
  icon: "solar:calendar-mark-bold-duotone",
});

/** Missing / unavailable entity — the guarded "not available" placeholder. */
export const Unavailable = story({
  type: "custom:fibbers-datetime",
  entity: "input_datetime.does_not_exist",
  name: "Vakantie",
});
