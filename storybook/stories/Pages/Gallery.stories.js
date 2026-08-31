import { renderCard } from "../../src/story.js";
import { HASS } from "../../src/hass.js";

export default {
  title: "Pages/Gallery",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

const CARDS = [
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
    type: "custom:fibbers-media",
    entity: "media_player.woonkamer",
    name: "Woonkamer",
    sources: [
      { name: "NPO 1", source: "NPO Radio 1" },
      { name: "NPO 2", source: "NPO Radio 2" },
      { name: "3FM", source: "NPO 3FM" },
    ],
  },
  {
    type: "custom:fibbers-graph",
    entity: "sensor.hue_motion_sensor_1_temperature",
    name: "Klimaat · woonkamer",
    color: "amber",
    decimals: 1,
    show_stats: true,
  },
  { type: "custom:fibbers-climate", entity: "climate.woonkamer" },
  {
    type: "custom:fibbers-weather",
    entity: "weather.thuis",
    name: "Thuis",
  },
  {
    type: "custom:fibbers-alert",
    checks: [
      { type: "unavailable_lights" },
      { type: "low_battery", below: 20 },
      { type: "updates" },
    ],
  },
  {
    type: "custom:fibbers-scene",
    favourites: 6,
    scenes: [
      { name: "Avond", icon: "solar:moon-bold-duotone", scene: "scene.avond" },
      { name: "Helder", icon: "solar:sun-bold-duotone", scene: "scene.helder" },
      {
        name: "Film",
        icon: "solar:clapperboard-play-bold-duotone",
        scene: "scene.film",
      },
      { name: "Eten", icon: "solar:tea-cup-bold-duotone", scene: "scene.eten" },
      {
        name: "Lezen",
        icon: "solar:book-2-bold-duotone",
        scene: "scene.lezen",
      },
      {
        name: "Nacht",
        icon: "solar:moon-stars-bold-duotone",
        scene: "scene.nacht",
      },
    ],
  },
  {
    type: "custom:fibbers-scheduler",
    name: "Wekker",
    time: "input_datetime.wake_time",
    enable: "input_boolean.wake_alarm_enabled",
    duration: "input_number.wake_fade",
    days: ["Ma", "Di", "Wo", "Do", "Vr"],
  },
];

/** A gallery of the cards on the dark theme — the hero shot for the README. */
export const Gallery = {
  render: () => {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "display:grid;grid-template-columns:repeat(2,minmax(320px,1fr));align-items:start;" +
      "gap:14px;padding:20px;background:#111516;color:#EDF1F1;" +
      "font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;";
    CARDS.forEach((c) => {
      const el = renderCard(c, HASS);
      el.style.display = "block";
      wrap.appendChild(el);
    });
    return wrap;
  },
};
