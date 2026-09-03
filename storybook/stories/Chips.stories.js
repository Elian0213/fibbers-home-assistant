import { story } from "../src/story.js";

export default {
  title: "Cards/Chips",
  tags: ["autodocs"],
};

/** An action pill row mixing toggle, call-service and navigate chips; "Wekker"
 * shows the blue active tint via `active_when`. */
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

/** Two chips wired to the same boolean: one tints active (state "on"), the other
 * stays inactive — the side-by-side contrast of the `active_when` tint. */
export const ActiveVsInactive = story({
  type: "custom:fibbers-chips",
  chips: [
    {
      name: "Radio aan",
      icon: "solar:radio-bold-duotone",
      action: { action: "toggle", entity: "input_boolean.wake_radio_enabled" },
      active_when: { entity: "input_boolean.wake_radio_enabled", state: "on" },
    },
    {
      name: "Radio uit",
      icon: "solar:radio-line-duotone",
      action: { action: "toggle", entity: "input_boolean.wake_radio_enabled" },
      active_when: { entity: "input_boolean.wake_radio_enabled", state: "off" },
    },
  ],
});

/** Icon-only chips (no `name`): the label span collapses so the pill hugs the glyph. */
export const IconOnly = story({
  type: "custom:fibbers-chips",
  chips: [
    {
      icon: "solar:home-bold-duotone",
      action: { action: "navigate", navigation_path: "/dashboard-thuis" },
    },
    {
      icon: "solar:lightbulb-bolt-bold-duotone",
      action: { action: "toggle", entity: "light.all_color_lights" },
      active_when: { entity: "light.all_color_lights", state: "on" },
    },
    {
      icon: "solar:settings-bold-duotone",
      action: { action: "more-info", entity: "light.all_color_lights" },
    },
  ],
});

/** Text-only chips (no `icon`): plain rounded pills with just a label. */
export const TextOnly = story({
  type: "custom:fibbers-chips",
  chips: [
    { name: "Avond", action: { action: "toggle", entity: "scene.avond" } },
    { name: "Film", action: { action: "toggle", entity: "scene.film" } },
    { name: "Nacht", action: { action: "toggle", entity: "scene.nacht" } },
  ],
});

/** A long chip list that wraps onto multiple rows to show the flex-wrap gap spacing. */
export const Wrapping = story({
  type: "custom:fibbers-chips",
  chips: [
    {
      name: "Avond",
      icon: "solar:moon-bold-duotone",
      action: { action: "toggle", entity: "scene.avond" },
    },
    {
      name: "Helder",
      icon: "solar:sun-bold-duotone",
      action: { action: "toggle", entity: "scene.helder" },
    },
    {
      name: "Film",
      icon: "solar:clapperboard-play-bold-duotone",
      action: { action: "toggle", entity: "scene.film" },
    },
    {
      name: "Eten",
      icon: "solar:cup-hot-bold-duotone",
      action: { action: "toggle", entity: "scene.eten" },
    },
    {
      name: "Ontspannen",
      icon: "solar:bath-bold-duotone",
      action: { action: "toggle", entity: "scene.ontspannen" },
    },
    {
      name: "Lezen",
      icon: "solar:book-bold-duotone",
      action: { action: "toggle", entity: "scene.lezen" },
    },
    {
      name: "Feest",
      icon: "solar:disco-ball-bold-duotone",
      action: { action: "toggle", entity: "scene.feest" },
    },
    {
      name: "Nacht",
      icon: "solar:moon-stars-bold-duotone",
      action: { action: "toggle", entity: "scene.nacht" },
    },
  ],
});
