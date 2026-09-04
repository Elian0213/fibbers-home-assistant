import { story } from "../src/story.js";

export default {
  title: "Cards/Light Detail",
  tags: ["autodocs"],
};

/** A single colour light: brightness, a draggable colour wheel (hue = angle,
 * saturation = radius) and quick swatches. */
export const Colour = story({
  type: "custom:fibbers-light-detail",
  entity: "light.tv_led_strip",
});

/** Opened from a room/group: a Philips-Hue-style picker. The Colour wheel (and the
 * Warm strip) carry one draggable dot per lamp — drag a dot onto another to snap
 * them to the same colour — with the lamps listed below for brightness and on/off. */
export const Room = story({
  type: "custom:fibbers-light-detail",
  entity: "light.tv_led_strip",
  groupName: "Woonkamer",
  siblings: [
    "light.tv_led_strip",
    "light.kitchen_lsc_led_strip",
    "light.kitchen",
    "light.woonkamer_computer",
  ],
});

/** A colour-temperature-only light — brightness + a warmth slider + white swatches,
 * no hue/saturation. */
export const TemperatureOnly = story({
  type: "custom:fibbers-light-detail",
  entity: "light.leeslamp",
});

/** A plain dimmable light — brightness only. */
export const Brightness = story({
  type: "custom:fibbers-light-detail",
  entity: "light.kitchen",
});

/** Unavailable — the controls collapse to a dimmed header, not an empty row. */
export const Offline = story({
  type: "custom:fibbers-light-detail",
  entity: "light.hue_go_1",
});
