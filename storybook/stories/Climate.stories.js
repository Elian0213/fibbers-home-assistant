import { story } from "../src/story.js";

export default {
  title: "Cards/Climate",
  tags: ["autodocs"],
};

/** Heating: current 21.4° above a 21° setpoint, "verwarmen" action, heat chip lit. */
export const Heating = story({
  type: "custom:fibbers-climate",
  entity: "climate.woonkamer",
});

/** Cooling: current 24.2° driven down to a 21° setpoint, cool chip active. */
export const Cooling = story({
  type: "custom:fibbers-climate",
  entity: "climate.slaapkamer",
});

/** Idle at setpoint: heat mode but current temp equals target, so the action reads idle. */
export const Idle = story({
  type: "custom:fibbers-climate",
  entity: "climate.kantoor",
});

/** Off: no active action, off chip lit; stepper stays interactive at the last setpoint. */
export const Off = story({
  type: "custom:fibbers-climate",
  entity: "climate.zolder",
});

/** Custom name override replacing the entity's friendly_name in the header. */
export const NamedOverride = story({
  type: "custom:fibbers-climate",
  entity: "climate.woonkamer",
  name: "Woonkamer",
});

/** Heat_cool range: no single setpoint, so a 19–24° low–high band shows and the −/+ steppers are inert. */
export const HeatCoolRange = story({
  type: "custom:fibbers-climate",
  entity: "climate.serre",
});

/** Unavailable: whole card dimmed, setpoint dash, mode chips disabled. */
export const Unavailable = story({
  type: "custom:fibbers-climate",
  entity: "climate.garage",
});
