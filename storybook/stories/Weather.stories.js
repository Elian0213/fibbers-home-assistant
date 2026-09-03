import { story } from "../src/story.js";

export default {
  title: "Cards/Weather",
  tags: ["autodocs"],
};

/** Current conditions plus the default five-day forecast strip. */
export const Default = story({
  type: "custom:fibbers-weather",
  entity: "weather.thuis",
  name: "Thuis",
});

/** A trimmed strip: `days: 3` keeps only the next three forecast columns. */
export const Compact = story({
  type: "custom:fibbers-weather",
  entity: "weather.thuis",
  name: "Thuis",
  days: 3,
});

/** No `name` — the card falls back to the entity's friendly name for the label. */
export const FriendlyNameFallback = story({
  type: "custom:fibbers-weather",
  entity: "weather.thuis",
});

/** `language: en` renders the condition label and weekday names in English. */
export const English = story({
  type: "custom:fibbers-weather",
  entity: "weather.thuis",
  name: "Home",
  language: "en",
});

/** A `sunny` entity — the sun icon with a warm temperature. */
export const Sunny = story({
  type: "custom:fibbers-weather",
  entity: "weather.thuis_zonnig",
  name: "Thuis",
});

/** A `rainy` entity — the rain-cloud icon over a cool, wet forecast. */
export const Rainy = story({
  type: "custom:fibbers-weather",
  entity: "weather.thuis_regen",
  name: "Thuis",
});

/** A `clear-night` entity — the moon icon for an overnight reading. */
export const ClearNight = story({
  type: "custom:fibbers-weather",
  entity: "weather.thuis_nacht",
  name: "Thuis",
});

/** An `unavailable` entity — the card shows its not-available placeholder line. */
export const Unavailable = story({
  type: "custom:fibbers-weather",
  entity: "weather.onbeschikbaar",
  name: "Weerstation",
});
