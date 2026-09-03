import { story } from "../src/story.js";
import { HASS, HASS_ALL_CLEAR } from "../src/hass.js";

export default {
  title: "Cards/Room",
  tags: ["autodocs"],
};

/** 2 of 3 lights on — the tile glows green and reads "2 van 3 aan". Tap opens its sheet. */
export const Lit = story({
  type: "custom:fibbers-room",
  name: "Woonkamer",
  icon: "solar:sofa-2-bold-duotone",
  entities: ["light.tv_led_strip", "light.kitchen", "light.woonkamer_computer"],
  sheet: "woonkamer",
});

/** All configured lights on — reads "2 van 2 aan", fully lit glow. */
export const AllOn = story({
  type: "custom:fibbers-room",
  name: "Keuken",
  icon: "solar:chef-hat-minimalistic-bold-duotone",
  entities: ["light.kitchen", "light.kitchen_lsc_led_strip"],
  sheet: "keuken",
});

/** All lights off but reachable — reads "Uit", neutral surface. */
export const Off = story(
  {
    type: "custom:fibbers-room",
    name: "Slaapkamer",
    icon: "solar:bed-bold-duotone",
    entities: ["light.hue_go_1", "light.hue_lightstrip_plus_1"],
    sheet: "slaapkamer",
  },
  { hass: HASS_ALL_CLEAR },
);

/** Every light unavailable — the tile dims and the state text turns red ("Offline"). */
export const Offline = story(
  {
    type: "custom:fibbers-room",
    name: "Slaapkamer",
    icon: "solar:bed-bold-duotone",
    entities: ["light.hue_go_1", "light.hue_lightstrip_plus_1"],
    sheet: "slaapkamer",
  },
  { hass: HASS },
);
