import { renderCard } from "../../src/story.js";
import { HASS_HOME } from "../../src/hass.js";

export default {
  title: "Pages/Dashboard",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

// A phone-width "Huis" view: a scrollable column of cards under the pinned nav bar.
const GREETING = {
  type: "custom:fibbers-greeting",
  name_from: "person.elian",
  lights: "light.all_color_lights",
  sensors: ["sensor.hue_motion_sensor_1_temperature"],
};

const ROOMS = [
  {
    type: "custom:fibbers-room",
    name: "Woonkamer",
    icon: "solar:sofa-2-bold-duotone",
    entities: [
      "light.tv_led_strip",
      "light.kitchen",
      "light.woonkamer_computer",
    ],
    sheet: "woonkamer",
  },
  {
    type: "custom:fibbers-room",
    name: "Keuken",
    icon: "solar:chef-hat-minimalistic-bold-duotone",
    entities: ["light.kitchen_lsc_led_strip"],
    sheet: "keuken",
  },
];

const LIGHT = {
  type: "custom:fibbers-light-row",
  entity: "light.tv_led_strip",
  name: "TV LED",
};

const GRAPH = {
  type: "custom:fibbers-graph",
  entity: "sensor.hue_motion_sensor_1_temperature",
  name: "Klimaat · woonkamer",
  color: "amber",
  decimals: 1,
  show_stats: true,
};

const ALERT = {
  type: "custom:fibbers-alert",
  checks: [
    { type: "unavailable_lights" },
    { type: "low_battery", below: 20 },
    { type: "updates" },
  ],
};

const SCENE = {
  type: "custom:fibbers-scene",
  favourites: 4,
  scenes: [
    { name: "Avond", icon: "solar:moon-bold-duotone", scene: "scene.avond" },
    { name: "Helder", icon: "solar:sun-bold-duotone", scene: "scene.helder" },
    {
      name: "Film",
      icon: "solar:clapperboard-play-bold-duotone",
      scene: "scene.film",
    },
    { name: "Eten", icon: "solar:tea-cup-bold-duotone", scene: "scene.eten" },
  ],
};

// The first tab's path matches the iframe so it renders as the active tab.
const NAV = {
  type: "custom:fibbers-nav",
  tabs: [
    {
      name: "Huis",
      icon: "solar:home-2-bold-duotone",
      path: location.pathname,
    },
    {
      name: "Licht",
      icon: "solar:lightbulb-bolt-bold-duotone",
      path: "/licht",
    },
    { name: "Muziek", icon: "solar:music-note-bold-duotone", path: "/muziek" },
    { name: "TV", icon: "solar:tv-bold-duotone", path: "/tv" },
    {
      name: "Meer",
      icon: "solar:menu-dots-bold-duotone",
      path: "/meer",
      badge: { entity: "update.home_assistant_core", when: "on" },
    },
  ],
};

/** A composed phone "Huis" view — the hero shot for the README. */
export const Dashboard = {
  render: () => {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "max-width:390px;margin:0 auto;padding:16px 14px 96px;display:flex;flex-direction:column;" +
      "gap:12px;min-height:100dvh;background:#111516;color:#EDF1F1;" +
      "font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;";

    wrap.appendChild(renderCard(GREETING, HASS_HOME));

    const roomRow = document.createElement("div");
    roomRow.style.cssText =
      "display:grid;grid-template-columns:1fr 1fr;gap:12px;";
    ROOMS.forEach((r) => roomRow.appendChild(renderCard(r, HASS_HOME)));
    wrap.appendChild(roomRow);

    [LIGHT, GRAPH, ALERT, SCENE].forEach((c) =>
      wrap.appendChild(renderCard(c, HASS_HOME)),
    );

    // connect the (invisible) nav controller so it attaches the bottom bar to body
    document.body.appendChild(renderCard(NAV, HASS_HOME));
    return wrap;
  },
};
