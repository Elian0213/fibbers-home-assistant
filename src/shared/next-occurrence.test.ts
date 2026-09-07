/* Unit tests for the pure alarm scheduling logic. `now` is injected, so no clock
 * mocking is needed. Weekday indices follow JS getDay() (0 = Sunday). */
import { describe, expect, test } from "bun:test";

import { dayModeToWeekdays, nextAlarm } from "./next-occurrence";

// A fixed reference: 2026-09-07 is a Monday, 08:00 local.
const MON_08 = new Date(2026, 8, 7, 8, 0, 0, 0);
const SAT_08 = new Date(2026, 8, 12, 8, 0, 0, 0); // Saturday
const day = (d: Date | null): number | null => (d ? d.getDay() : null);

describe("dayModeToWeekdays", () => {
  test("every-day phrasings → all 7 days", () => {
    expect(dayModeToWeekdays("Elke dag")).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(dayModeToWeekdays("Every day")).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(dayModeToWeekdays("daily")).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  test("weekday phrasings → Mon-Fri", () => {
    expect(dayModeToWeekdays("Werkdagen")).toEqual([1, 2, 3, 4, 5]);
    expect(dayModeToWeekdays("Weekdays")).toEqual([1, 2, 3, 4, 5]);
  });

  test("weekend → Sat + Sun", () => {
    expect(dayModeToWeekdays("Weekend")).toEqual([0, 6]);
  });

  test("unrecognised / empty → null (tile shows a dash)", () => {
    expect(dayModeToWeekdays("Alleen dinsdag")).toBeNull();
    expect(dayModeToWeekdays("")).toBeNull();
    expect(dayModeToWeekdays(null)).toBeNull();
    expect(dayModeToWeekdays(undefined)).toBeNull();
  });
});

describe("nextAlarm", () => {
  const everyDay = [0, 1, 2, 3, 4, 5, 6];
  const weekdays = [1, 2, 3, 4, 5];
  const weekend = [0, 6];

  test("every day, time still ahead today → today", () => {
    const r = nextAlarm(MON_08, "09:00", everyDay);
    expect(r.when).toBe("today");
    expect(day(r.date)).toBe(1); // Monday
    expect(r.date!.getHours()).toBe(9);
  });

  test("every day, time already passed today → tomorrow", () => {
    const r = nextAlarm(MON_08, "07:30", everyDay);
    expect(r.when).toBe("tomorrow");
    expect(day(r.date)).toBe(2); // Tuesday
  });

  test("exactly now does not count as today (rolls forward)", () => {
    const r = nextAlarm(MON_08, "08:00", everyDay);
    expect(r.when).toBe("tomorrow");
  });

  test("weekdays on a Monday with time passed → tomorrow (Tue)", () => {
    const r = nextAlarm(MON_08, "07:00", weekdays);
    expect(r.when).toBe("tomorrow");
    expect(day(r.date)).toBe(2);
  });

  test("weekend on a Monday → the coming Saturday (a 'later' weekday)", () => {
    const r = nextAlarm(MON_08, "09:00", weekend);
    expect(r.when).toBe("later");
    expect(day(r.date)).toBe(6); // Saturday
  });

  test("weekdays on a Saturday → the coming Monday", () => {
    const r = nextAlarm(SAT_08, "09:00", weekdays);
    expect(r.when).toBe("later");
    expect(day(r.date)).toBe(1); // Monday
  });

  test("null/empty weekday set or bad time → unknown", () => {
    expect(nextAlarm(MON_08, "09:00", null)).toEqual({
      when: null,
      date: null,
    });
    expect(nextAlarm(MON_08, "09:00", [])).toEqual({ when: null, date: null });
    expect(nextAlarm(MON_08, "unavailable", everyDay)).toEqual({
      when: null,
      date: null,
    });
    expect(nextAlarm(MON_08, "25:00", everyDay)).toEqual({
      when: null,
      date: null,
    });
  });

  test("accepts an HH:MM:SS prefix", () => {
    const r = nextAlarm(MON_08, "09:00:00", everyDay);
    expect(r.when).toBe("today");
  });
});
