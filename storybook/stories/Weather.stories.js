import { story } from "../src/story.js";

export default {
  title: "Cards/Weather",
  tags: ["autodocs"],
};

/** Current conditions plus a five-day forecast from the weather entity. */
export const Default = story({
  type: "custom:fibbers-weather",
  entity: "weather.thuis",
  name: "Thuis",
});
