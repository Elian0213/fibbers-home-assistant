/* A stubbed `hass` for the stories, ported from docs/preview.html. `makeHass`
 * takes flags so stories can show lit / offline / low-battery / all-clear states. */

const NOW = "2026-08-31T15:00:00+00:00";

export function makeHass(flags = {}) {
  const f = { tvLed: true, hueGo: false, battLow: false, update: true, ...flags };
  const S = {};
  const add = (id, state, attributes = {}) =>
    (S[id] = { entity_id: id, state, attributes, last_changed: NOW, last_updated: NOW });

  // lights (the 6 real bulbs + the group)
  add("light.tv_led_strip", f.tvLed ? "on" : "off", {
    friendly_name: "TV LED",
    brightness: f.tvLed ? 204 : 0,
    color_mode: f.tvLed ? "hs" : null,
    supported_color_modes: ["hs", "color_temp"],
  });
  add("light.kitchen", "on", { friendly_name: "Gitaarlamp", brightness: 178 });
  add("light.woonkamer_computer", "off", { friendly_name: "Computer" });
  add("light.kitchen_lsc_led_strip", "on", { friendly_name: "Keuken LED", brightness: 120 });
  add("light.hue_go_1", f.hueGo ? "off" : "unavailable", { friendly_name: "Slaapkamerlamp" });
  add("light.hue_lightstrip_plus_1", f.hueGo ? "off" : "unavailable", { friendly_name: "Bedroom LED" });
  add("light.all_color_lights", f.tvLed ? "on" : "off", {
    friendly_name: "Alle lampen",
    entity_id: [
      "light.tv_led_strip",
      "light.kitchen",
      "light.woonkamer_computer",
      "light.kitchen_lsc_led_strip",
      "light.hue_go_1",
      "light.hue_lightstrip_plus_1",
    ],
  });

  // sensors
  add("sensor.hue_motion_sensor_1_temperature", "21.4", {
    friendly_name: "Temperatuur woonkamer",
    unit_of_measurement: "°C",
    device_class: "temperature",
  });
  add("sensor.hue_motion_sensor_1_battery", f.battLow ? "8" : "92", {
    friendly_name: "Batterij bewegingssensor",
    unit_of_measurement: "%",
    device_class: "battery",
  });

  // helpers
  add("input_boolean.wake_alarm_enabled", "on", { friendly_name: "Wekker ingeschakeld" });

  // updates (the domain, not a named entity)
  add("update.home_assistant_core", f.update ? "on" : "off", {
    friendly_name: "Home Assistant Core update",
    device_class: "update",
  });

  // scenes (Avond most recently activated)
  add("scene.avond", "2026-08-31T19:12:00+00:00", { friendly_name: "Avond" });
  add("scene.helder", "2026-08-31T08:03:00+00:00", { friendly_name: "Helder" });
  add("scene.film", "2026-08-30T21:40:00+00:00", { friendly_name: "Film" });

  return {
    states: S,
    language: "nl",
    callService: (d, s, x) => console.log("[callService]", d + "." + s, x || {}),
    callWS: async () => ({}),
    localize: (k) => k,
    themes: { darkMode: true },
    user: { name: "Elian", is_admin: true },
  };
}

export const HASS = makeHass(); // tv on, hue offline, battery ok, update pending
export const HASS_OFFLINE = makeHass({ hueGo: false });
export const HASS_ALL_CLEAR = makeHass({ hueGo: true, update: false, battLow: false });
export const HASS_BATT_LOW = makeHass({ battLow: true });
