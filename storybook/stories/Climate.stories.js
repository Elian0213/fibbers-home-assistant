import { story } from "../src/story.js";

export default {
  title: "Cards/Climate",
  tags: ["autodocs"],
};

/** Thermostat: current temp, setpoint with −/+, and hvac-mode chips. */
export const Default = story({
  type: "custom:fibbers-climate",
  entity: "climate.woonkamer",
});
