/* ================================================================== *
 * weather-util — the bits shared by fibbers-weather (the tile) and its detail
 * sheet (fibbers-weather-sheet): the condition→icon map and small formatters.
 * ================================================================== */

/** A single forecast entry from the weather/subscribe_forecast feed (daily or hourly). */
export interface Forecast {
  datetime?: string;
  condition?: string;
  temperature?: number;
  templow?: number;
}

/** Solar duotone icon per HA weather condition slug. */
export const COND_ICON: Record<string, string> = {
  "clear-night": "solar:moon-bold-duotone",
  sunny: "solar:sun-bold-duotone",
  partlycloudy: "solar:cloud-sun-bold-duotone",
  cloudy: "solar:cloud-bold-duotone",
  fog: "solar:cloud-bold-duotone",
  rainy: "solar:cloud-rain-bold-duotone",
  pouring: "solar:cloud-rain-bold-duotone",
  "lightning-rainy": "solar:cloud-rain-bold-duotone",
  lightning: "solar:cloud-rain-bold-duotone",
  snowy: "solar:cloud-bold-duotone",
  "snowy-rainy": "solar:cloud-rain-bold-duotone",
  hail: "solar:cloud-rain-bold-duotone",
  windy: "solar:cloud-bold-duotone",
  "windy-variant": "solar:cloud-bold-duotone",
  exceptional: "solar:cloud-bold-duotone",
};

/** Solar icon for an HA condition slug, with a cloud fallback for anything unmapped. */
export const iconFor = (c: string | undefined): string =>
  COND_ICON[c as string] || "solar:cloud-bold-duotone";

/** Round to a whole number, or null for a non-numeric input (so callers can show "—"). */
export const round = (n: unknown): number | null =>
  Number.isFinite(Number(n)) ? Math.round(Number(n)) : null;

/** Localised short weekday for a forecast datetime (trailing "." stripped); "" on a bad date. */
export const dayName = (iso: string, lang: string): string => {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed)
    .toLocaleDateString(lang || "en", { weekday: "short" })
    .replace(".", "");
};

/** Localised HH:MM for an hourly-forecast / sun-time datetime; "" on a bad date. */
export const hourLabel = (iso: string, lang: string): string => {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toLocaleTimeString(lang || "en", {
    hour: "2-digit",
    minute: "2-digit",
  });
};
