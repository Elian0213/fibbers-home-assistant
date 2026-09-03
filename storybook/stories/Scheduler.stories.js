import { story } from "../src/story.js";

export default {
  title: "Cards/Scheduler",
  tags: ["autodocs"],
};

/** The full card: enabled wake time, fade window and weekday chips. */
export const Wekker = story({
  type: "custom:fibbers-scheduler",
  name: "Wekker",
  time: "input_datetime.wake_time",
  enable: "input_boolean.wake_alarm_enabled",
  duration: "input_number.wake_fade",
  days: ["Ma", "Di", "Wo", "Do", "Vr"],
});

/** Just the big time and enable pill — no fade window, no weekday chips. */
export const TimeOnly = story({
  type: "custom:fibbers-scheduler",
  name: "Wekker",
  time: "input_datetime.wake_time",
  enable: "input_boolean.wake_alarm_enabled",
});

/** No enable entity: the pill is dropped and the card reads as always-on. */
export const NoToggle = story({
  type: "custom:fibbers-scheduler",
  name: "Zonsopgang",
  time: "input_datetime.keuken_dag_start",
  duration: "input_number.opkomst_duur",
});

/** A time-only helper with a date-only entity: the big time falls back to "—". */
export const NoTime = story({
  type: "custom:fibbers-scheduler",
  name: "Vakantie",
  time: "input_datetime.vakantie_start",
  enable: "input_boolean.wake_alarm_enabled",
});
