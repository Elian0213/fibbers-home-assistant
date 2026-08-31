import { story } from "../src/story.js";
import { HASS } from "../src/hass.js";

export default {
  title: "Cards/Stat",
  tags: ["autodocs"],
};

/** Reads an entity — state, unit and name come from Home Assistant. */
export const Temperature = story({
  type: "custom:fibbers-stat",
  entity: "sensor.hue_motion_sensor_1_temperature",
  icon: "solar:temperature-bold-duotone",
  name: "Woonkamer",
  decimals: 1,
});

/** A literal `value` with a secondary line and a trend arrow — the Pi's CPU. */
export const Cpu = story({
  type: "custom:fibbers-stat",
  name: "Raspberry Pi",
  icon: "solar:cpu-bold-duotone",
  value: 51.1,
  unit: "°C",
  sub: "SD 20,9% · RAM 1,6 GB · up 2d",
  trend: "up",
  color: "blue",
});

/** Non-numeric values pass through untouched — a backup time. */
export const Backup = story({
  type: "custom:fibbers-stat",
  name: "Back-up",
  icon: "solar:diskette-bold-duotone",
  value: "02:55",
  sub: "Geslaagd · volgende 03:12",
});

/** An unavailable entity reads "—" on a muted tile. */
export const Offline = story(
  {
    type: "custom:fibbers-stat",
    entity: "light.hue_go_1",
    name: "Slaapkamer",
    icon: "solar:temperature-bold-duotone",
    unit: "°C",
  },
  { hass: HASS },
);
