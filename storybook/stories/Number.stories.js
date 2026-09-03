import { story } from "../src/story.js";

export default {
  title: "Cards/Number",
  tags: ["autodocs"],
};

/** A drag slider bound to an input_number (1–60 min), across its min/max/step. */
export const Slider = story({
  type: "custom:fibbers-number",
  entity: "input_number.opkomst_duur",
  name: "Opkomst duur",
  icon: "solar:hourglass-bold-duotone",
});

/** The same helper as a −/+ stepper — compact row with big tap targets. */
export const Stepper = story({
  type: "custom:fibbers-number",
  entity: "input_number.opkomst_duur",
  name: "Opkomst duur",
  icon: "solar:hourglass-bold-duotone",
  mode: "stepper",
});

/** A 0–100 % helper (tv_backlight) — inherits the entity's own unit. */
export const Percentage = story({
  type: "custom:fibbers-number",
  entity: "input_number.tv_backlight",
  name: "Achtergrondlicht",
  icon: "solar:sun-bold-duotone",
});

/** Config overrides — custom unit label and a coarser step of 5. */
export const CustomStep = story({
  type: "custom:fibbers-number",
  entity: "input_number.wake_fade",
  name: "Wek-fade",
  icon: "solar:alarm-bold-duotone",
  unit: "minuten",
  step: 5,
});

/** Missing / unavailable entity — muted, disabled track. */
export const Unavailable = story({
  type: "custom:fibbers-number",
  entity: "input_number.does_not_exist",
  name: "Opkomst duur",
});

/** Fractional 0.5 step over a −5…5 °C range — decimal formatting on a negative value. */
export const FractionalStep = story({
  type: "custom:fibbers-number",
  entity: "input_number.thermostat_offset",
  name: "Thermostaat offset",
  icon: "solar:temperature-bold-duotone",
});

/** A native number.* domain entity (printer flow, 50–150 %) driven by set_value. */
export const NativeNumber = story({
  type: "custom:fibbers-number",
  entity: "number.printer_flow",
  name: "Printer flow",
  icon: "solar:printer-bold-duotone",
});
