import { story } from "../src/story.js";
import { HASS_HOME } from "../src/hass.js";

export default {
  title: "Cards/Greeting",
  tags: ["autodocs"],
};

/** Time-of-day header with a lights / presence / temperature subline. */
export const Header = story({
  type: "custom:fibbers-greeting",
  name_from: "person.elian",
  lights: "light.all_color_lights",
  sensors: ["sensor.hue_motion_sensor_1_temperature"],
});

/** Same header with someone home (Elian thuis). */
export const Thuis = story(
  {
    type: "custom:fibbers-greeting",
    name_from: "person.elian",
    lights: "light.all_color_lights",
    sensors: ["sensor.hue_motion_sensor_1_temperature"],
  },
  { hass: HASS_HOME },
);
