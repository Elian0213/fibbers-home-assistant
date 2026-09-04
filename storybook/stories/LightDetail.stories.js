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

/** Opened from a room/group: a Philips-Hue-style picker. One circle carries a
 * draggable, icon-labelled marker per lamp — colour lamps on the hue/saturation wheel,
 * tunable-white lamps on a warm↔cool track across the centre. Drag one marker onto
 * another to group them (one marker + a count badge that moves as one); tap a lamp in
 * the tiles to pop it back out. The lamps sit below as tiles (colour + icon, instant
 * on/off, tap to focus); the focused lamp is ringed in the theme accent. On a wide
 * screen the modal widens into a two-column layout (wheel left, controls + tiles right). */
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

/** Room opened focused on a lamp that is off — the brightness slider keeps its knob
 * at 0% (dragging it turns the lamp on), instead of collapsing to an empty line. */
export const RoomOffLamp = story({
  type: "custom:fibbers-light-detail",
  entity: "light.woonkamer_computer",
  groupName: "Woonkamer",
  siblings: [
    "light.woonkamer_computer",
    "light.tv_led_strip",
    "light.kitchen_lsc_led_strip",
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
