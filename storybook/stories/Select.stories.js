import { story } from "../src/story.js";

export default {
  title: "Cards/Select",
  tags: ["autodocs"],
};

/** Few options → a chip row (auto). */
export const Chips = story({
  type: "custom:fibbers-select",
  entity: "input_select.wake_days",
  name: "Wek-dagen",
});

/** Many options → a self-styled dropdown (auto), never ha-select. */
export const Dropdown = story({
  type: "custom:fibbers-select",
  entity: "input_select.keuken_kleur_dag",
  name: "Kleur overdag",
  icon: "solar:palette-bold-duotone",
});

/** Missing / unavailable entity. */
export const Unavailable = story({
  type: "custom:fibbers-select",
  entity: "input_select.does_not_exist",
  name: "Kleur overdag",
});
