/* A stubbed `hass` for the stories. `makeHass` takes flags so stories can show
 * lit / offline / low-battery / all-clear states. */

const NOW = "2026-08-31T15:00:00+00:00";

export function makeHass(flags = {}) {
  const f = {
    tvLed: true,
    hueGo: false,
    battLow: false,
    update: true,
    home: false,
    ...flags,
  };
  const S = {};
  const add = (id, state, attributes = {}) =>
    (S[id] = {
      entity_id: id,
      state,
      attributes,
      last_changed: NOW,
      last_updated: NOW,
    });

  // lights (the 6 real bulbs + the group)
  add("light.tv_led_strip", f.tvLed ? "on" : "off", {
    friendly_name: "TV LED",
    brightness: f.tvLed ? 204 : 0,
    color_mode: f.tvLed ? "hs" : null,
    supported_color_modes: ["hs", "color_temp"],
  });
  add("light.kitchen", "on", { friendly_name: "Gitaarlamp", brightness: 178 });
  add("light.woonkamer_computer", "off", { friendly_name: "Computer" });
  add("light.kitchen_lsc_led_strip", "on", {
    friendly_name: "Keuken LED",
    brightness: 120,
  });
  add("light.hue_go_1", f.hueGo ? "off" : "unavailable", {
    friendly_name: "Slaapkamerlamp",
  });
  add("light.hue_lightstrip_plus_1", f.hueGo ? "off" : "unavailable", {
    friendly_name: "Bedroom LED",
  });
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
  add("input_boolean.wake_alarm_enabled", "on", {
    friendly_name: "Wekker ingeschakeld",
  });

  // updates (the domain, not a named entity)
  add("update.home_assistant_core", f.update ? "on" : "off", {
    friendly_name: "Home Assistant Core update",
    device_class: "update",
  });

  // scenes (Avond most recently activated)
  add("scene.avond", "2026-08-31T19:12:00+00:00", { friendly_name: "Avond" });
  add("scene.helder", "2026-08-31T08:03:00+00:00", { friendly_name: "Helder" });
  add("scene.film", "2026-08-30T21:40:00+00:00", { friendly_name: "Film" });
  add("scene.eten", "2026-08-30T18:20:00+00:00", { friendly_name: "Eten" });
  add("scene.ontspannen", "2026-08-29T22:05:00+00:00", {
    friendly_name: "Ontspannen",
  });
  add("scene.lezen", "2026-08-29T21:00:00+00:00", { friendly_name: "Lezen" });
  add("scene.feest", "2026-08-28T23:30:00+00:00", { friendly_name: "Feest" });
  add("scene.nacht", "2026-08-31T01:15:00+00:00", { friendly_name: "Nacht" });

  // presence
  add("person.elian", f.home ? "home" : "not_home", { friendly_name: "Elian" });
  add("person.chelsea", "not_home", { friendly_name: "Chelsea" });

  // backup (last run + next scheduled)
  add("sensor.backup_last", "2026-08-31T02:55:00+00:00", {
    friendly_name: "Laatste back-up",
    device_class: "timestamp",
  });
  add("sensor.backup_next", "2026-09-01T03:12:00+00:00", {
    friendly_name: "Volgende back-up",
    device_class: "timestamp",
  });

  // weather (current + 5-day forecast)
  add("weather.thuis", "partlycloudy", {
    friendly_name: "Thuis",
    temperature: 18,
    temperature_unit: "°C",
    humidity: 65,
    forecast: [
      {
        datetime: "2026-08-31",
        condition: "partlycloudy",
        temperature: 19,
        templow: 12,
      },
      {
        datetime: "2026-09-01",
        condition: "sunny",
        temperature: 22,
        templow: 13,
      },
      {
        datetime: "2026-09-02",
        condition: "rainy",
        temperature: 17,
        templow: 11,
      },
      {
        datetime: "2026-09-03",
        condition: "cloudy",
        temperature: 18,
        templow: 12,
      },
      {
        datetime: "2026-09-04",
        condition: "pouring",
        temperature: 15,
        templow: 10,
      },
    ],
  });

  // media player (Sonos)
  add("media_player.woonkamer", "playing", {
    friendly_name: "Sonos Woonkamer",
    media_title: "Never Gonna Give You Up",
    media_artist: "Rick Astley",
    volume_level: 0.42,
    source: "NPO Radio 2",
    source_list: ["NPO Radio 1", "NPO Radio 2", "NPO 3FM", "Radio 538"],
    media_content_type: "music",
    app_name: "Sonos",
  });

  // raspberry pi telemetry
  add("sensor.pi_cpu", "8", {
    friendly_name: "Pi CPU",
    unit_of_measurement: "%",
  });
  add("sensor.pi_temp", "51.1", {
    friendly_name: "Pi temperatuur",
    unit_of_measurement: "°C",
  });
  add("sensor.pi_disk", "20.9", {
    friendly_name: "Pi schijf",
    unit_of_measurement: "%",
  });
  add("sensor.pi_ram", "34", {
    friendly_name: "Pi RAM",
    unit_of_measurement: "%",
  });
  add("sensor.pi_uptime", "2 dagen", { friendly_name: "Pi uptime" });

  // scheduler helpers
  add("input_datetime.wake_time", "05:25:00", {
    friendly_name: "Wektijd",
    has_time: true,
    has_date: false,
  });
  add("input_number.wake_fade", "20", {
    friendly_name: "Wek-fade",
    unit_of_measurement: "min",
  });

  // remote + climate
  add("remote.woonkamer_tv", "on", {
    friendly_name: "TV",
    supported_features: 4,
  });
  add("climate.woonkamer", "heat", {
    friendly_name: "Thermostaat Woonkamer",
    current_temperature: 21.4,
    temperature: 21,
    target_temp_step: 0.5,
    min_temp: 5,
    max_temp: 30,
    hvac_modes: ["off", "heat", "cool", "auto"],
    hvac_action: "heating",
  });

  return {
    states: S,
    language: "nl",
    callService: (d, s, x) =>
      console.log("[callService]", d + "." + s, x || {}),
    // synthetic history so fibbers-graph renders against the stub (deterministic wave)
    callWS: async (msg) => {
      if (msg && msg.type === "history/history_during_period") {
        const out = {};
        for (const id of msg.entity_ids || []) {
          const base = Number((S[id] || {}).state);
          const b = Number.isFinite(base) ? base : 20;
          const amp = Math.abs(b) * 0.05 + 0.6;
          out[id] = Array.from({ length: 24 }, (_, i) => ({
            s: (b + Math.sin(i / 3) * amp + (i - 12) * 0.03).toFixed(2),
            lu: 0,
          }));
        }
        return out;
      }
      return {};
    },
    localize: (k) => k,
    themes: { darkMode: true },
    user: { name: "Elian", is_admin: true },
  };
}

export const HASS = makeHass(); // tv on, hue offline, battery ok, update pending
export const HASS_OFFLINE = makeHass({ hueGo: false });
export const HASS_ALL_CLEAR = makeHass({
  hueGo: true,
  update: false,
  battLow: false,
});
export const HASS_BATT_LOW = makeHass({ battLow: true });
export const HASS_HOME = makeHass({ home: true }); // Elian thuis
