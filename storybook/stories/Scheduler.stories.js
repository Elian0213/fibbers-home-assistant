import { story } from "../src/story.js";

export default {
  title: "Cards/Scheduler",
  tags: ["autodocs"],
};

/** A wake time with an enable switch, a fade window and weekday chips. */
export const Wekker = story({
  type: "custom:fibbers-scheduler",
  name: "Wekker",
  time: "input_datetime.wake_time",
  enable: "input_boolean.wake_alarm_enabled",
  duration: "input_number.wake_fade",
  days: ["Ma", "Di", "Wo", "Do", "Vr"],
});
