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

/** Same header with someone home (", Elian" title + "Elian thuis"). */
export const Thuis = story(
  {
    type: "custom:fibbers-greeting",
    name_from: "person.elian",
    lights: "light.all_color_lights",
    sensors: ["sensor.hue_motion_sensor_1_temperature"],
  },
  { hass: HASS_HOME },
);

/** A light group expanded to members: 4 of 6 on, 2 offline counted separately. */
export const WithOffline = story({
  type: "custom:fibbers-greeting",
  lights: "light.woonkamer_lampen",
});

/** Bare title only — no lights, sensors or name, just "nobody home". */
export const TitleOnly = story({
  type: "custom:fibbers-greeting",
});

/** Two sensors trailing the subline (temperature · battery). */
export const Sensors = story({
  type: "custom:fibbers-greeting",
  lights: "light.all_color_lights",
  sensors: [
    "sensor.hue_motion_sensor_1_temperature",
    "sensor.hue_motion_sensor_1_battery",
  ],
});

/** English subline via a language override on the same live states. */
export const English = story({
  type: "custom:fibbers-greeting",
  name_from: "person.elian",
  lights: "light.all_color_lights",
  sensors: ["sensor.hue_motion_sensor_1_temperature"],
  language: "en",
});
