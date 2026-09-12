import { story } from "../src/story.js";

export default {
  title: "Cards/Rooms, Lights & Scenes/Master",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Full-width master switch. The subline lists the live blast radius; " +
          "`confirm: hold` guards the heavy instance and every press can be undone.",
      },
    },
  },
};

/** The everyday case — one tap, accent tone, the whole light group. */
export const AllLightsOff = story({
  type: "custom:fibbers-master",
  name: "Alle lampen uit",
  icon: "solar:lightbulb-bolt-bold-duotone",
  tone: "accent",
  confirm: "none",
  targets: {
    lights: ["light.all_color_lights"],
  },
});

/** The heavy case — red, hold-to-confirm, lamps + both TVs + the Sonos. Lamps are
 *  counted (offline bulbs ignored), media named: "3 lampen · Apple TV · …". */
export const Everything = story({
  type: "custom:fibbers-master",
  name: "Alles uit",
  icon: "solar:power-bold-duotone",
  tone: "red",
  confirm: "hold",
  hold_ms: 700,
  undo: 12,
  targets: {
    lights: [
      "light.tv_led_strip",
      "light.kitchen",
      "light.woonkamer_computer",
      "light.kitchen_lsc_led_strip",
      "light.hue_lightstrip_plus_1",
    ],
    media_off: ["media_player.appletv", "media_player.philips"],
    media_stop: ["media_player.woonkamer"],
  },
});

/** Nothing on → the subline reads "Alles is al uit" and the press is a no-op. */
export const AlreadyOff = story({
  type: "custom:fibbers-master",
  name: "Alles uit",
  icon: "solar:power-bold-duotone",
  tone: "red",
  confirm: "hold",
  targets: {
    lights: ["light.hal_1", "light.hal_2"],
  },
});

/** A pinned `subtitle` replaces the auto inventory with a fixed line. */
export const FixedSubtitle = story({
  type: "custom:fibbers-master",
  name: "Alles uit",
  subtitle: "Lampen, tv en muziek",
  icon: "solar:power-bold-duotone",
  tone: "red",
  confirm: "hold",
  targets: {
    lights: ["light.all_color_lights"],
    media_stop: ["media_player.woonkamer"],
  },
});
