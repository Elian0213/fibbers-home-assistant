import { story } from "../src/story.js";

export default {
  title: "Cards/Light Group",
  tags: ["autodocs"],
};

/** A room master: 2 of 4 on at mixed brightness (striped fill), one bulb
 * offline, and a stale ghost id skipped from the count. The top-right toggle
 * switches every member; tapping the tile (anywhere but the slider or the
 * toggle) opens the multi-lamp light-detail sheet. */
export const Mixed = story({
  type: "custom:fibbers-light-group",
  entity: "light.woonkamer_lampen",
  name: "Woonkamer",
  icon: "solar:sofa-2-bold-duotone",
});

/** All members on at the same brightness — solid fill, no stripe. */
export const AllOn = story({
  type: "custom:fibbers-light-group",
  entity: "light.keuken_spots",
  name: "Keuken",
  icon: "solar:chef-hat-minimalistic-bold-duotone",
});

/** All members off — neutral surface, reads "Uit". */
export const AllOff = story({
  type: "custom:fibbers-light-group",
  entity: "light.hal_lampen",
  name: "Hal",
});

/** All members unavailable — dimmed, red secondary, slider disabled. */
export const AllOffline = story({
  type: "custom:fibbers-light-group",
  entity: "light.schuur_lampen",
  name: "Schuur",
});

/** No group entity — the `entities:` form synthesises the master. */
export const NoGroupEntity = story({
  type: "custom:fibbers-light-group",
  name: "Woonkamer",
  icon: "solar:sofa-2-bold-duotone",
  entities: ["light.tv_led_strip", "light.kitchen", "light.woonkamer_computer"],
});
