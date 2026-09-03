import { story } from "../src/story.js";

export default {
  title: "Cards/Nav",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

const NAV = {
  type: "custom:fibbers-nav",
  tabs: [
    {
      name: "Huis",
      icon: "solar:home-2-bold-duotone",
      path: "/dashboard-thuis/huis",
    },
    {
      name: "Licht",
      icon: "solar:lightbulb-bolt-bold-duotone",
      path: "/dashboard-thuis/licht",
    },
    {
      name: "Muziek",
      icon: "solar:music-note-bold-duotone",
      path: "/dashboard-thuis/muziek",
    },
    { name: "TV", icon: "solar:tv-bold-duotone", path: "/dashboard-thuis/tv" },
    {
      name: "Meer",
      icon: "solar:menu-dots-bold-duotone",
      path: "/dashboard-thuis/meer",
      badge: { entity: "update.home_assistant_core", when: "on" },
    },
  ],
};

/** Five tabs with a live notification badge on "Meer" (update pending). The bar renders
 * into the story iframe's document.body and pins to its bottom. */
export const Default = story(NAV);

/** A minimal two-tab bar — the card-picker stub config, no badges. */
export const TwoTabs = story({
  type: "custom:fibbers-nav",
  tabs: [
    { name: "Home", icon: "solar:home-2-bold-duotone", path: "/lovelace/0" },
    {
      name: "Lights",
      icon: "solar:lightbulb-bolt-bold-duotone",
      path: "/lovelace/1",
    },
  ],
});

/** `offset_bottom` lifts the whole bar above a companion-app tab strip. */
export const WithOffset = story({ ...NAV, offset_bottom: 48 });

/** `extra_bottom` pads the reserved view space so content clears the bar with room to spare. */
export const ExtraBottom = story({ ...NAV, extra_bottom: 24 });

/** Light theme palette instead of the default Fibbers dark bar. */
export const LightTheme = story({ ...NAV, theme: "fibbers-light" });

/** `hide_ha_tabs: "header"` swaps HA's own view tabs for this bar as the sole navigation. */
export const HidesHaTabs = story({ ...NAV, hide_ha_tabs: "header" });
