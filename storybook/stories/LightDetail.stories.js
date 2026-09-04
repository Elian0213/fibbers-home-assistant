import { story } from "../src/story.js";

export default {
  title: "Cards/Light Detail",
  tags: ["autodocs"],
};

/** A colour + colour-temperature light: brightness, a warm→cool temperature slider,
 * hue and saturation sliders (gradient tracks), and quick swatches. */
export const Colour = story({
  type: "custom:fibbers-light-detail",
  entity: "light.tv_led_strip",
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
