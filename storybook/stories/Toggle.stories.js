import { story } from "../src/story.js";

export default {
  title: "Cards/Toggle",
  tags: ["autodocs"],
};

/** On state: accent icon tile and the pill switched to the right, with a static subline. */
export const Aan = story({
  type: "custom:fibbers-toggle",
  entity: "input_boolean.wake_radio_enabled",
  name: "Radio aan",
  icon: "solar:soundwave-bold-duotone",
  secondary: "Speelt NPO Radio 2",
});

/** Off state: muted icon tile, pill to the left. */
export const Uit = story({
  type: "custom:fibbers-toggle",
  entity: "switch.tv_screen_off",
  name: "Scherm uit",
  icon: "solar:tv-bold-duotone",
});

/** Secondary subline pulled live from another entity's formatted state. */
export const SecondaryEntity = story({
  type: "custom:fibbers-toggle",
  entity: "input_boolean.wake_alarm_enabled",
  name: "Wekker",
  icon: "solar:alarm-bold-duotone",
  secondary_entity: "input_datetime.wake_time",
});

/** Confirm guard: toggling pops a window.confirm before calling the service. */
export const Confirm = story({
  type: "custom:fibbers-toggle",
  entity: "input_boolean.wake_alarm_enabled",
  name: "Wekker uitschakelen",
  icon: "solar:alarm-turn-off-bold-duotone",
  confirm: true,
});

/** Missing / unavailable entity falls back to the not-available placeholder. */
export const Unavailable = story({
  type: "custom:fibbers-toggle",
  entity: "input_boolean.does_not_exist",
  name: "Radio aan",
});

/** Automation domain: an enabled automation renders on the shared pill switched to the right. */
export const Automation = story({
  type: "custom:fibbers-toggle",
  entity: "automation.verlichting_avond",
  name: "Avondlicht",
  icon: "solar:lightbulb-bolt-bold-duotone",
});
