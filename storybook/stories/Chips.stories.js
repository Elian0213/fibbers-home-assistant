import { story } from "../src/story.js";

export default {
  title: "Cards/Chips",
  tags: ["autodocs"],
};

/** An action pill row; "Wekker" shows the blue active tint via `active_when`. */
export const Default = story({
  type: "custom:fibbers-chips",
  chips: [
    {
      name: "Wekker",
      icon: "solar:alarm-bold-duotone",
      action: { action: "toggle", entity: "input_boolean.wake_alarm_enabled" },
      active_when: { entity: "input_boolean.wake_alarm_enabled", state: "on" },
    },
    {
      name: "Alles uit",
      icon: "solar:power-bold-duotone",
      action: {
        action: "call-service",
        service: "light.turn_off",
        target: { entity_id: "light.all_color_lights" },
      },
    },
    {
      name: "Muziek",
      icon: "solar:music-note-bold-duotone",
      action: {
        action: "navigate",
        navigation_path: "/dashboard-thuis/muziek",
      },
    },
  ],
});
