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

/** Five tabs with a notification badge on "Meer". The bar renders into the story iframe's
 * document.body and pins to its bottom. */
export const Default = story(NAV);

/** `offset_bottom` lifts the bar above a companion-app tab strip. */
export const WithOffset = story({ ...NAV, offset_bottom: 48 });
