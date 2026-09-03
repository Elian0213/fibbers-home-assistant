import { story } from "../src/story.js";

export default {
  title: "Cards/Select",
  tags: ["autodocs"],
};

/** Few options → a chip row (auto), the active option accented. */
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

/** `mode: dropdown` forces the collapsed picker even for few options. */
export const DropdownForced = story({
  type: "custom:fibbers-select",
  entity: "input_select.wake_days",
  name: "Wek-dagen",
  mode: "dropdown",
});

/** `mode: chips` forces the full chip row even with many options (wraps). */
export const ChipsForced = story({
  type: "custom:fibbers-select",
  entity: "input_select.tv_picture_style",
  name: "Beeldstijl",
  icon: "solar:tv-bold-duotone",
  mode: "chips",
});

/** `chips_max: 3` tips the 7-option picker into dropdown via the auto threshold. */
export const ChipsMax = story({
  type: "custom:fibbers-select",
  entity: "input_select.tv_picture_style",
  name: "Beeldstijl",
  chips_max: 3,
});

/** Missing / unavailable entity → the not-available placeholder. */
export const Unavailable = story({
  type: "custom:fibbers-select",
  entity: "input_select.does_not_exist",
  name: "Kleur overdag",
});
