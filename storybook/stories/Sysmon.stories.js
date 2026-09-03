import { story } from "../src/story.js";

export default {
  title: "Cards/Sysmon",
  tags: ["autodocs"],
};

/** Raspberry-Pi telemetry: four metric tiles + a CPU history sparkline. */
export const RaspberryPi = story({
  type: "custom:fibbers-sysmon",
  title: "Raspberry Pi",
  metrics: [
    {
      label: "CPU",
      entity: "sensor.pi_cpu",
      unit: "%",
      icon: "solar:cpu-bold-duotone",
    },
    {
      label: "Temp",
      entity: "sensor.pi_temp",
      unit: "°C",
      decimals: 1,
      icon: "solar:temperature-bold-duotone",
    },
    {
      label: "Schijf",
      entity: "sensor.pi_disk",
      unit: "%",
      icon: "solar:ssd-square-bold-duotone",
    },
    {
      label: "RAM",
      entity: "sensor.pi_ram",
      unit: "%",
      icon: "solar:ssd-round-bold-duotone",
    },
  ],
  graph: "sensor.pi_cpu",
});

/** Tiles only, no `graph:` — the sparkline area renders nothing. */
export const TilesOnly = story({
  type: "custom:fibbers-sysmon",
  title: "Systeem",
  metrics: [
    {
      label: "CPU",
      entity: "sensor.pi_cpu",
      unit: "%",
      icon: "solar:cpu-bold-duotone",
    },
    {
      label: "RAM",
      entity: "sensor.pi_ram",
      unit: "%",
      icon: "solar:ssd-round-bold-duotone",
    },
  ],
});

/** No `title:` — the uppercase header is omitted and the grid sits flush. */
export const Untitled = story({
  type: "custom:fibbers-sysmon",
  metrics: [
    {
      label: "Temp",
      entity: "sensor.pi_temp",
      unit: "°C",
      decimals: 1,
      icon: "solar:temperature-bold-duotone",
    },
    {
      label: "Schijf",
      entity: "sensor.pi_disk",
      unit: "%",
      icon: "solar:ssd-square-bold-duotone",
    },
  ],
});

/** Non-numeric states pass through untouched: a text uptime and a relative
 * timestamp render without a unit. */
export const TextStates = story({
  type: "custom:fibbers-sysmon",
  title: "Status",
  metrics: [
    {
      label: "Uptime",
      entity: "sensor.pi_uptime",
      icon: "solar:clock-circle-bold-duotone",
    },
    {
      label: "Laatste herstart",
      entity: "sensor.system_monitor_last_boot",
      icon: "solar:refresh-circle-bold-duotone",
    },
  ],
});

/** A missing/unavailable metric falls back to an em-dash placeholder next to
 * the healthy tiles. */
export const Unavailable = story({
  type: "custom:fibbers-sysmon",
  title: "Raspberry Pi",
  metrics: [
    {
      label: "CPU",
      entity: "sensor.pi_cpu",
      unit: "%",
      icon: "solar:cpu-bold-duotone",
    },
    {
      label: "GPU",
      entity: "sensor.pi_gpu_temp",
      unit: "°C",
      icon: "solar:temperature-bold-duotone",
    },
  ],
});
