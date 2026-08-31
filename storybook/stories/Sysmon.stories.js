import { story } from "../src/story.js";

export default {
  title: "Cards/Sysmon",
  tags: ["autodocs"],
};

/** Raspberry-Pi telemetry: metric tiles + a CPU sparkline. */
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
