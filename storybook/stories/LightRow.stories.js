import { story } from "../src/story.js";

export default {
  title: "Cards/Light Row",
  tags: ["autodocs"],
};

/** On in a colour mode — value reads "Kleur · 80%"; the slider is set to brightness. */
export const Colour = story({
  type: "custom:fibbers-light-row",
  entity: "light.tv_led_strip",
});

/** On — value reads the brightness percentage. */
export const Dimmed = story({
  type: "custom:fibbers-light-row",
  entity: "light.kitchen",
});

/** A custom name + icon override the entity's friendly_name and default bulb glyph. */
export const Named = story({
  type: "custom:fibbers-light-row",
  entity: "light.kitchen_lsc_led_strip",
  name: "Keuken strip",
  icon: "solar:lightbulb-bolt-bold-duotone",
});

/** Off — value reads "Uit" and the icon box is muted. */
export const Off = story({
  type: "custom:fibbers-light-row",
  entity: "light.woonkamer_computer",
});

/** Unreachable — value reads "Onbereikbaar" and the slider is disabled. */
export const Unavailable = story({
  type: "custom:fibbers-light-row",
  entity: "light.hue_go_1",
});

/** Tapping the icon box toggles a whole group (via `icon_entity`), not just this light. */
export const GroupToggle = story({
  type: "custom:fibbers-light-row",
  entity: "light.tv_led_strip",
  icon_entity: "light.all_color_lights",
});

/** On/off-only plug — no brightness, so the row renders a plain pill switch instead of a slider. */
export const OnOffPill = story({
  type: "custom:fibbers-light-row",
  entity: "light.stekker_lamp",
});

/** On at 2700 K — value reads "Warm · 59%" from the warm colour-temp label. */
export const Warm = story({
  type: "custom:fibbers-light-row",
  entity: "light.leeslamp",
});
