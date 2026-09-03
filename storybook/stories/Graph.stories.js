import { story } from "../src/story.js";

export default {
  title: "Cards/Graph",
  tags: ["autodocs"],
};

/** Default accent sparkline: reads the entity's last 24 h via `history/history_during_period`, unit + current value from the state. */
export const History = story({
  type: "custom:fibbers-graph",
  entity: "sensor.pi_temp",
  name: "Pi · temperatuur",
  hours: 24,
});

/** Reads an entity's last 24 h of history with min/max stats and 1 decimal. */
export const Klimaat = story({
  type: "custom:fibbers-graph",
  entity: "sensor.hue_motion_sensor_1_temperature",
  name: "Klimaat · woonkamer",
  hours: 24,
  decimals: 1,
  color: "amber",
  show_stats: true,
});

/** A literal `data` series overrides the fetch — the Pi's CPU load. */
export const Cpu = story({
  type: "custom:fibbers-graph",
  name: "Pi · CPU",
  unit: "%",
  color: "blue",
  data: [
    8, 11, 9, 14, 22, 18, 12, 10, 9, 13, 27, 41, 33, 21, 16, 12, 10, 9, 11, 15,
    13, 10, 9, 8,
  ],
});

/** Line only (no area fill). */
export const LineOnly = story({
  type: "custom:fibbers-graph",
  name: "Vochtigheid",
  unit: "%",
  fill: false,
  color: "green",
  data: [52, 53, 55, 54, 56, 58, 57, 55, 54, 53, 52, 51, 52, 54, 55, 56],
});

/** A red, taller trace for a spiky metric emphasised via `height`. */
export const Tall = story({
  type: "custom:fibbers-graph",
  name: "Pi · RAM",
  unit: "%",
  color: "red",
  height: 80,
  show_stats: true,
  data: [34, 36, 40, 55, 72, 61, 44, 38, 35, 33, 48, 66, 58, 41, 37, 34],
});

/** Fewer than two points: the "no history" line instead of a sparkline. */
export const NoHistory = story({
  type: "custom:fibbers-graph",
  name: "Geen historie",
  unit: "%",
  data: [42],
});
