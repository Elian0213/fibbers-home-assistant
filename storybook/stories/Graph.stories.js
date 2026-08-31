import { story } from "../src/story.js";

export default {
  title: "Cards/Graph",
  tags: ["autodocs"],
};

/** Reads an entity's last 24 h of history (via `history/history_during_period`). */
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
