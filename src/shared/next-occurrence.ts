/* ================================================================== *
 * NEXT-OCCURRENCE — pure alarm scheduling logic for fibbers-alarm.
 * Kept out of src/cards so the day-mode recogniser's keyword literals aren't
 * scanned by check-i18n (they are matched, never displayed). All functions are
 * pure and take `now` as an argument so they're deterministic under test.
 * ================================================================== */

/** JS getDay() indices: 0 = Sunday … 6 = Saturday. */
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

/**
 * Map an `input_select` day-mode option string to the weekday set it covers, or
 * null when the option isn't one of the recognised modes. Recognises the common
 * English + Dutch phrasings by keyword (case-insensitive) — a purely internal
 * mapping, so unrecognised options degrade to a "—" next-occurrence (spec §5)
 * rather than guessing. Never assume the exact strings elsewhere; the option must
 * round-trip to select_option verbatim.
 * @param option — the entity's current option string
 */
export function dayModeToWeekdays(
  option: string | null | undefined,
): number[] | null {
  if (!option) return null;
  const s = option.trim().toLowerCase();
  if (/every ?day|daily|all ?days|elke dag|iedere dag|alle dagen/.test(s))
    return EVERY_DAY;
  if (/weekday|werkdag|weekdag|doordeweeks/.test(s)) return WEEKDAYS;
  if (/weekend/.test(s)) return WEEKEND;
  return null;
}

/** The next time the alarm fires, relative to `now`. */
export interface NextAlarm {
  /** "today" | "tomorrow" for the two near days, "later" for a further weekday, null when unknown. */
  when: "today" | "tomorrow" | "later" | null;
  /** The next fire datetime, or null when the time/day set can't be interpreted. */
  date: Date | null;
}

/**
 * The next datetime the alarm fires: the first qualifying weekday at `hhmm`,
 * from today (only if the time is still ahead) up to a week out. Returns
 * `{when:null,date:null}` for an uninterpretable time or a null/empty weekday set
 * (the tile then shows "—", spec §5). `now` is injected for deterministic tests.
 * @param now — the reference instant
 * @param hhmm — "HH:MM" (a longer "HH:MM:SS" prefix is accepted)
 * @param weekdays — getDay() indices that qualify, or null
 */
export function nextAlarm(
  now: Date,
  hhmm: string | null | undefined,
  weekdays: number[] | null,
): NextAlarm {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ""));
  if (!m || !weekdays || !weekdays.length) return { when: null, date: null };
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return { when: null, date: null };
  for (let add = 0; add <= 7; add += 1) {
    const d = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + add,
      h,
      min,
      0,
      0,
    );
    if (!weekdays.includes(d.getDay())) continue;
    // Today only counts if the time hasn't already passed.
    if (add === 0 && d.getTime() <= now.getTime()) continue;
    let when: NextAlarm["when"] = "later";
    if (add === 0) when = "today";
    else if (add === 1) when = "tomorrow";
    return { when, date: d };
  }
  return { when: null, date: null };
}
