/* A stubbed `hass` for the stories. `makeHass` takes flags so stories can show
 * lit / offline / low-battery / all-clear states. */

const NOW = "2026-08-31T15:00:00+00:00";

// --- live demo state -------------------------------------------------------
// Real HA echoes a service call back as new entity state; the stub applies a
// best-effort optimistic update to its own `states` and notifies listeners so the
// rendered cards re-render — this is what makes the demos interactive (drag a
// colour, toggle a switch, move a slider and it sticks). story.js registers a
// listener that re-pushes `hass` to every live card.
const liveListeners = new Set();

/** Register a callback fired after every stubbed service call. */
export function onLiveUpdate(cb) {
  liveListeners.add(cb);
}

const stamp = (st) => {
  st.last_changed = new Date().toISOString();
  st.last_updated = st.last_changed;
};

/** Apply a service call to the stub's `states`, best-effort, for the domains the
 *  cards actually drive. Unknown services are a no-op but still notify. */
function applyService(states, domain, service, data = {}) {
  for (const id of [].concat(data.entity_id || [])) {
    const st = states[id];
    if (!st) continue;
    const a = st.attributes;
    if (domain === "light" && service === "turn_on") {
      st.state = "on";
      if (data.brightness != null) a.brightness = data.brightness;
      if (data.brightness_pct != null)
        a.brightness = Math.round(data.brightness_pct * 2.55);
      if (data.hs_color) {
        a.hs_color = data.hs_color;
        a.color_mode = "hs";
        delete a.color_temp_kelvin;
      }
      if (data.rgb_color) a.rgb_color = data.rgb_color;
      if (data.color_temp_kelvin != null) {
        a.color_temp_kelvin = data.color_temp_kelvin;
        a.color_mode = "color_temp";
        delete a.hs_color;
        delete a.rgb_color;
      }
    } else if (domain === "light" && service === "turn_off") {
      st.state = "off";
    } else if (
      ["switch", "input_boolean", "fan", "automation", "script"].includes(domain)
    ) {
      if (service === "toggle") st.state = st.state === "on" ? "off" : "on";
      else if (service === "turn_on") st.state = "on";
      else if (service === "turn_off") st.state = "off";
    } else if (
      (domain === "input_number" || domain === "number") &&
      service === "set_value"
    ) {
      st.state = String(data.value);
    } else if (
      (domain === "input_select" || domain === "select") &&
      service === "select_option"
    ) {
      st.state = data.option;
    } else if (domain === "climate" && service === "set_temperature") {
      if (data.temperature != null) a.temperature = data.temperature;
    } else if (domain === "climate" && service === "set_hvac_mode") {
      st.state = data.hvac_mode;
    } else if (domain === "media_player") {
      if (service === "media_play_pause")
        st.state = st.state === "playing" ? "paused" : "playing";
      else if (service === "media_play") st.state = "playing";
      else if (service === "media_pause") st.state = "paused";
      else if (service === "volume_set" && data.volume_level != null)
        a.volume_level = data.volume_level;
      else if (service === "select_source" && data.source) a.source = data.source;
    } else if (domain === "scene" && service === "turn_on") {
      a.last_activated = new Date().toISOString();
    }
    stamp(st);
  }
  liveListeners.forEach((cb) => cb());
}

// Synthetic forecast for the weather card + detail sheet (the real feed is a WS
// subscription the stub doesn't run). Daily = 7 days with high/low, hourly = 24h.
function synthForecast(hourly) {
  const conds = [
    "partlycloudy",
    "sunny",
    "cloudy",
    "rainy",
    "partlycloudy",
    "sunny",
    "clear-night",
  ];
  const n = hourly ? 24 : 7;
  const step = hourly ? 3600e3 : 86400e3;
  const t0 = Date.parse(NOW);
  return Array.from({ length: n }, (_, i) => {
    const base = 15 + Math.round(6 * Math.sin(i / (hourly ? 4 : 1.5)));
    const entry = {
      datetime: new Date(t0 + i * step).toISOString(),
      condition: conds[i % conds.length],
      temperature: base,
    };
    if (!hourly) entry.templow = base - 6;
    return entry;
  });
}

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
    hs_color: f.tvLed ? [280, 72] : null,
    rgb_color: f.tvLed ? [194, 71, 255] : null,
    supported_color_modes: ["hs", "color_temp"],
  });
  add("light.kitchen", "on", { friendly_name: "Gitaarlamp", brightness: 178 });
  add("light.woonkamer_computer", "off", {
    friendly_name: "Computer",
    supported_color_modes: ["color_temp"],
    min_color_temp_kelvin: 2000,
    max_color_temp_kelvin: 6535,
  });
  add("light.kitchen_lsc_led_strip", "on", {
    friendly_name: "Keuken LED",
    brightness: 120,
    color_mode: "hs",
    hs_color: [140, 75],
    rgb_color: [64, 255, 128],
    supported_color_modes: ["hs", "color_temp"],
    min_color_temp_kelvin: 2000,
    max_color_temp_kelvin: 6535,
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

  // light-group demo groups. woonkamer_lampen exercises mixed brightness (tv 80%
  // vs gitaarlamp 70%), one offline member (hue_go_1) and a ghost id skipped.
  add("light.woonkamer_lampen", "on", {
    friendly_name: "Woonkamer lampen",
    entity_id: [
      "light.tv_led_strip",
      "light.kitchen",
      "light.woonkamer_computer",
      "light.hue_go_1",
      "light.christmas_tree", // stale Hue entry: no state object, must be skipped
    ],
  });
  add("light.keuken_spots", "on", {
    friendly_name: "Keuken spots",
    entity_id: ["light.spot_1", "light.spot_2", "light.spot_3"],
  });
  add("light.spot_1", "on", { friendly_name: "Spot 1", brightness: 191 });
  add("light.spot_2", "on", { friendly_name: "Spot 2", brightness: 191 });
  add("light.spot_3", "on", { friendly_name: "Spot 3", brightness: 191 });
  add("light.hal_lampen", "off", {
    friendly_name: "Hal",
    entity_id: ["light.hal_1", "light.hal_2"],
  });
  add("light.hal_1", "off", { friendly_name: "Hal 1" });
  add("light.hal_2", "off", { friendly_name: "Hal 2" });
  add("light.schuur_lampen", "unavailable", {
    friendly_name: "Schuur",
    entity_id: ["light.schuur_1", "light.schuur_2"],
  });
  add("light.schuur_1", "unavailable", { friendly_name: "Schuur 1" });
  add("light.schuur_2", "unavailable", { friendly_name: "Schuur 2" });

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
    apparent_temperature: 16,
    wind_speed: 12,
    wind_speed_unit: "km/h",
    pressure: 1013,
    pressure_unit: "hPa",
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
  add("sensor.pi_gpu_temp", "48.6", {
    friendly_name: "Pi GPU temperatuur",
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
    min: 0,
    max: 60,
    step: 1,
  });
  add("input_number.opkomst_duur", "20", {
    friendly_name: "Opkomst duur",
    unit_of_measurement: "min",
    min: 1,
    max: 60,
    step: 1,
  });

  // input_select — a 3-option (chips) and a 12-option (dropdown) helper
  add("input_select.wake_days", "Werkdagen", {
    friendly_name: "Wek-dagen",
    options: ["Elke dag", "Werkdagen", "Weekend"],
  });
  add("input_select.keuken_kleur_dag", "Warm wit", {
    friendly_name: "Kleur overdag",
    options: [
      "Warm wit",
      "Koel wit",
      "Daglicht",
      "Rood",
      "Oranje",
      "Geel",
      "Groen",
      "Cyaan",
      "Blauw",
      "Paars",
      "Roze",
      "Magenta",
    ],
  });

  add("input_boolean.wake_radio_enabled", "on", { friendly_name: "Radio aan" });

  // fibbers-alarm helpers (the full wake-up set)
  add("input_datetime.wake_up_time", "09:00:00", {
    friendly_name: "Wektijd",
    has_time: true,
    has_date: false,
  });
  add("input_datetime.wake_fade_start", "08:40:00", {
    friendly_name: "Licht vanaf",
    has_time: true,
    has_date: false,
  });
  add("input_number.wake_brightness", "100", {
    friendly_name: "Eindhelderheid",
    unit_of_measurement: "%",
    min: 10,
    max: 100,
    step: 10,
  });
  add("input_number.wake_volume", "15", {
    friendly_name: "Wekvolume",
    unit_of_measurement: "%",
    min: 5,
    max: 60,
    step: 5,
  });
  add("input_select.wake_radio_station", "IE · SPIN 1038", {
    friendly_name: "Wekradio zender",
    options: [
      "NL · NPO Radio 1",
      "NL · NPO Radio 2",
      "NL · 3FM",
      "NL · Radio 538",
      "NL · Qmusic",
      "NL · Sky Radio",
      "NL · Radio Veronica",
      "NL · SLAM!",
      "NL · 100% NL",
      "NL · Radio 10",
      "IE · RTÉ Radio 1",
      "IE · RTÉ 2FM",
      "IE · Today FM",
      "IE · Newstalk",
      "IE · SPIN 1038",
      "IE · FM104",
      "IE · 98FM",
      "IE · Radio Nova",
    ],
  });
  add("input_text.wake_status", "Radio gestart 04:45 · IE · SPIN 1038", {
    friendly_name: "Wekker status",
    max: 255,
  });

  add("input_datetime.keuken_dag_start", "07:00:00", {
    friendly_name: "Dag begint om",
    has_time: true,
    has_date: false,
  });
  add("input_datetime.vakantie_start", "2026-12-20", {
    friendly_name: "Vakantie",
    has_time: false,
    has_date: true,
  });

  // non-numeric states for the stat/sysmon formatting stories
  add("binary_sensor.hue_motion_sensor_1_motion", "off", {
    friendly_name: "Beweging woonkamer",
    device_class: "motion",
  });
  add("sensor.system_monitor_last_boot", "2026-08-29T22:26:37+00:00", {
    friendly_name: "Laatste herstart",
    device_class: "timestamp",
  });

  // remote + climate
  add("remote.woonkamer_tv", "on", {
    friendly_name: "TV",
    supported_features: 4,
  });

  // remote-card devices (0.8.x). appletv reports NO volume_level → the volume row
  // renders as the scrub strip; philips reports one → a positional slider, and
  // carries the controls-panel entities (picture-style select, backlight number,
  // screen-off switch). A speaker (media_player only) reuses media_player.woonkamer.
  add("remote.appletv", "on", { friendly_name: "Apple TV" });
  add("media_player.appletv", "playing", {
    friendly_name: "Apple TV",
    media_title: "The Bear",
    app_name: "Netflix",
    source: "Netflix",
    source_list: [
      "Netflix",
      "YouTube",
      "Prime Video",
      "Spotify",
      "Disney+",
      "NPO Start",
      "Videoland",
    ],
    // Seekable playback → the touchpad's scrub gesture engages (drag left/right
    // while playing pauses + scrubs the timeline).
    media_position: 912,
    media_duration: 3120,
    // prev/next/play/pause/select_source/seek; advertises VOLUME_SET but no level
    supported_features: 450487,
  });
  add("remote.philips", "on", { friendly_name: "Philips TV" });
  add("media_player.philips", "on", {
    friendly_name: "Philips TV",
    volume_level: 0.27,
    is_volume_muted: false,
    supported_features: 155581,
  });
  add("input_select.tv_picture_style", "Dolby Vision Dark", {
    friendly_name: "Beeldstijl",
    options: [
      "Persoonlijk",
      "Levendig",
      "Natuurlijk",
      "Film",
      "Monitor",
      "Dolby Vision Bright",
      "Dolby Vision Dark",
    ],
  });
  add("input_number.tv_backlight", "70", {
    friendly_name: "Achtergrondlicht",
    min: 0,
    max: 100,
    step: 1,
    unit_of_measurement: "%",
  });
  add("switch.tv_screen_off", "off", { friendly_name: "Scherm uit" });
  add("remote.beamer", "on", { friendly_name: "Beamer" });
  // a media_player-only speaker for the switcher's speaker device (no d-pad)
  add("media_player.keuken_sonos", "playing", {
    friendly_name: "Sonos Keuken",
    media_title: "Redbone",
    media_artist: "Childish Gambino",
    volume_level: 0.35,
    is_volume_muted: false,
    source: "Spotify",
    source_list: ["Spotify", "Radio 538", "TuneIn", "Line-In"],
    // pause/volume/mute/prev/next/select_source/step/play
    supported_features: 19517,
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
  // extra climate states for the story variants (cool / off / idle-at-setpoint)
  add("climate.slaapkamer", "cool", {
    friendly_name: "Thermostaat Slaapkamer",
    current_temperature: 24.2,
    temperature: 21,
    target_temp_step: 0.5,
    min_temp: 5,
    max_temp: 30,
    hvac_modes: ["off", "heat", "cool", "auto"],
    hvac_action: "cooling",
  });
  add("climate.zolder", "off", {
    friendly_name: "Thermostaat Zolder",
    current_temperature: 19.0,
    temperature: 18,
    target_temp_step: 0.5,
    min_temp: 5,
    max_temp: 30,
    hvac_modes: ["off", "heat", "cool", "auto"],
    hvac_action: "off",
  });
  add("climate.kantoor", "heat", {
    friendly_name: "Thermostaat Kantoor",
    current_temperature: 21.0,
    temperature: 21,
    target_temp_step: 0.5,
    min_temp: 5,
    max_temp: 30,
    hvac_modes: ["off", "heat", "cool", "auto"],
    hvac_action: "idle",
  });
  // a paused player + a grouped player for the media story variants
  add("media_player.slaapkamer", "paused", {
    friendly_name: "Sonos Slaapkamer",
    media_title: "Weightless",
    media_artist: "Marconi Union",
    volume_level: 0.18,
    source: "Spotify",
    source_list: ["Spotify", "NPO Radio 2", "TuneIn"],
    media_content_type: "music",
    app_name: "Sonos",
  });
  add("media_player.badkamer", "playing", {
    friendly_name: "Sonos Badkamer",
    media_title: "Redbone",
    media_artist: "Childish Gambino",
    volume_level: 0.3,
    group_members: ["media_player.woonkamer", "media_player.badkamer"],
    media_content_type: "music",
    app_name: "Sonos",
    // GROUPING(524288) + play/pause/prev/next/volume/select_source
    supported_features: 543933,
  });
  add("media_player.zolder", "unavailable", { friendly_name: "Sonos Zolder" });

  // extra weather conditions for the weather story variants
  const forecast5 = (a, b, c, d, e) =>
    [a, b, c, d, e].map((cond, i) => ({
      datetime: `2026-09-0${i + 1}`,
      condition: cond,
      temperature: 18 + i,
      templow: 10 + i,
    }));
  add("weather.thuis_zonnig", "sunny", {
    friendly_name: "Thuis",
    temperature: 24,
    temperature_unit: "°C",
    humidity: 40,
    forecast: forecast5("sunny", "sunny", "partlycloudy", "cloudy", "rainy"),
  });
  add("weather.thuis_regen", "rainy", {
    friendly_name: "Thuis",
    temperature: 13,
    temperature_unit: "°C",
    humidity: 88,
    forecast: forecast5("rainy", "pouring", "cloudy", "partlycloudy", "sunny"),
  });
  add("weather.thuis_nacht", "clear-night", {
    friendly_name: "Thuis",
    temperature: 11,
    temperature_unit: "°C",
    humidity: 72,
    forecast: forecast5(
      "clear-night",
      "sunny",
      "sunny",
      "partlycloudy",
      "rainy",
    ),
  });
  add("weather.onbeschikbaar", "unavailable", { friendly_name: "Weerstation" });

  // sun entity for the weather sheet's sunrise/sunset row
  add("sun.sun", "above_horizon", {
    friendly_name: "Sun",
    next_rising: new Date(new Date(NOW).setHours(7, 12, 0, 0)).toISOString(),
    next_setting: new Date(new Date(NOW).setHours(20, 41, 0, 0)).toISOString(),
  });

  // climate range (heat_cool low–high band) + an unavailable thermostat
  add("climate.serre", "heat_cool", {
    friendly_name: "Thermostaat Serre",
    current_temperature: 21.5,
    target_temp_low: 19,
    target_temp_high: 24,
    target_temp_step: 0.5,
    min_temp: 5,
    max_temp: 30,
    hvac_modes: ["off", "heat", "cool", "heat_cool", "auto"],
    hvac_action: "idle",
  });
  add("climate.garage", "unavailable", { friendly_name: "Thermostaat Garage" });

  // toggle-card: an automation entity; backup-card: a failed result + empty state
  add("automation.verlichting_avond", "on", {
    friendly_name: "Verlichting – Avondlicht",
    last_triggered: "2026-08-31T19:12:00+00:00",
  });
  add("binary_sensor.backup_result", "on", {
    friendly_name: "Back-up mislukt",
    device_class: "problem",
  });
  add("sensor.backup_none", "unavailable", {
    friendly_name: "Laatste back-up",
    device_class: "timestamp",
  });

  // number-card: a fractional-step helper + a native number.* entity
  add("input_number.thermostat_offset", "-1.5", {
    friendly_name: "Thermostaat offset",
    unit_of_measurement: "°C",
    min: -5,
    max: 5,
    step: 0.5,
  });
  add("number.printer_flow", "102", {
    friendly_name: "Printer flow",
    unit_of_measurement: "%",
    min: 50,
    max: 150,
    step: 1,
  });

  // datetime-card: a combined date+time helper
  add("input_datetime.vergadering", "2026-09-08 09:30:00", {
    friendly_name: "Vergadering",
    has_time: true,
    has_date: true,
  });

  // light-row: an on/off-only plug (pill toggle) + a warm colour-temp bulb
  add("light.stekker_lamp", "on", {
    friendly_name: "Stekkerlamp",
    supported_color_modes: ["onoff"],
    color_mode: "onoff",
  });
  add("light.leeslamp", "on", {
    friendly_name: "Leeslamp",
    brightness: 150,
    color_temp_kelvin: 2700,
    color_mode: "color_temp",
    supported_color_modes: ["color_temp"],
  });

  return {
    states: S,
    language: "nl",
    callService: (d, s, x) => {
      console.log("[callService]", d + "." + s, x || {});
      applyService(S, d, s, x || {});
    },
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
    // A minimal connection stub: the weather cards subscribe to the forecast feed
    // over the WS connection, so hand them synthetic hourly + daily forecasts.
    connection: {
      subscribeMessage: (cb, msg) => {
        if (msg && msg.type === "weather/subscribe_forecast")
          cb({ forecast: synthForecast(msg.forecast_type === "hourly") });
        return Promise.resolve(() => {});
      },
    },
    localize: (k) => k,
    // A minimal stand-in for HA's own localiser, enough for the stories to show
    // motion / timestamp / numeric states the way the real frontend would.
    formatEntityState: (st) => {
      if (!st) return "";
      const a = st.attributes || {};
      if (a.device_class === "motion")
        return st.state === "on" ? "Gedetecteerd" : "Vrij";
      if (a.device_class === "timestamp") {
        const t = Date.parse(st.state);
        if (!isNaN(t)) {
          const mins = Math.max(0, Math.round((Date.now() - t) / 6e4));
          if (mins < 60) return `${mins} min geleden`;
          const hrs = Math.round(mins / 60);
          if (hrs < 24) return `${hrs} uur geleden`;
          return `${Math.round(hrs / 24)} dagen geleden`;
        }
      }
      const n = Number(st.state);
      if (Number.isFinite(n))
        return a.unit_of_measurement ? `${n} ${a.unit_of_measurement}` : `${n}`;
      return st.state;
    },
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
