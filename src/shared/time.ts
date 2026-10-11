/* ================================================================== *
 * TIME — HH:MM helpers for input_datetime states ("09:00:00"): parse, shift
 * across midnight, and step hours/minutes independently. Anything that isn't a
 * time ("unavailable", "unknown") yields "" so cards render a dash, not garbage.
 * ================================================================== */

/**
 * A real HH:MM (zero-padded) from an input_datetime state ("09:00:00") — else ""
 * so "unavailable"/"unknown" renders as a dash, not garbage. Accepts a 1- or
 * 2-digit hour.
 * @param s
 */
export const hhmm = (s: string | null | undefined): string => {
  const m = typeof s === "string" && s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
};

/** Minutes since midnight from an HH:MM, or null. @param s */
export const toMinutes = (s: string | null | undefined): number | null => {
  const t = hhmm(s);
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** HH:MM from minutes-since-midnight, wrapping across the day. @param mins */
const fromMinutes = (mins: number): string => {
  const total = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * Add `mins` (may be negative) to an HH:MM, wrapping across midnight — used for
 * "→ end" fade windows and the ± time stepper. "" when the input isn't a time.
 * @param s @param mins
 */
export const addMinutes = (
  s: string | null | undefined,
  mins: number,
): string => {
  const base = toMinutes(s);
  return base == null ? "" : fromMinutes(base + mins);
};

/**
 * Step an HH:MM by whole hours and/or minutes, each field wrapping independently
 * (23:00 +1h → 00:00; 09:59 +1m → 09:00) so the ± buttons never roll one field
 * into the other. "" when the input isn't a time.
 * @param s @param dHours @param dMinutes
 */
export const stepTime = (
  s: string | null | undefined,
  dHours: number,
  dMinutes: number,
): string => {
  const base = toMinutes(s);
  if (base == null) return "";
  let h = Math.floor(base / 60);
  let m = base % 60;
  h = (((h + dHours) % 24) + 24) % 24;
  m = (((m + dMinutes) % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/**
 * Localised short weekday ("ma", "Tue"), trailing "." stripped; "" on a bad date.
 * @param d — a Date or anything Date.parse reads
 * @param lang — BCP-47 language tag
 */
export const weekdayShort = (d: Date | string, lang: string): string => {
  const date = typeof d === "string" ? new Date(Date.parse(d)) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date
    .toLocaleDateString(lang || "en", { weekday: "short" })
    .replace(".", "");
};

/**
 * Localised HH:MM wall-clock time; "" on a bad date.
 * @param d — a Date or anything Date.parse reads
 * @param lang — BCP-47 language tag
 */
export const clockTime = (d: Date | string, lang: string): string => {
  const date = typeof d === "string" ? new Date(Date.parse(d)) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(lang || "en", {
    hour: "2-digit",
    minute: "2-digit",
  });
};
