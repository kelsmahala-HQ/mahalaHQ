// Habit math: which days a habit is due, the current streak, and a rolling 7-day view. Dates are
// plain "YYYY-MM-DD" strings (Eastern "today" comes from the server) so nothing here depends on a
// time zone. Pure -- shared by the Habits page and the toggle action.

import { WEEKDAY_ABBR } from "./weekdays";

export function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday .. 6 = Saturday, for a "YYYY-MM-DD" date. */
export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

/** A habit with no chosen weekdays is due every day. */
export function isScheduled(daysOfWeek: number[] | null | undefined, dateStr: string): boolean {
  return !daysOfWeek?.length || daysOfWeek.includes(weekdayOf(dateStr));
}

export type DayCell = {
  date: string;
  label: string; // Mon, Tue ...
  scheduled: boolean;
  done: boolean;
  isToday: boolean;
};

export type HabitStats = {
  streak: number;
  best: number;
  /** Percent of due days completed over the last 30 days, or null if nothing has been due yet. */
  rate30: number | null;
  week: DayCell[];
  dueToday: boolean;
  doneToday: boolean;
};

const LOOKBACK_DAYS = 400;

export function habitStats(
  habit: { days_of_week: number[] | null; created_at: string },
  doneDates: Set<string>,
  todayStr: string
): HabitStats {
  const days = habit.days_of_week;
  const created = habit.created_at.slice(0, 10);
  const dueToday = isScheduled(days, todayStr);
  const doneToday = doneDates.has(todayStr);

  // Current streak: due days in a row, newest first. Today doesn't break it while it's still open
  // (not done yet), but a missed earlier due day does. Days the habit isn't due are skipped.
  let streak = dueToday && doneToday ? 1 : 0;
  for (let i = 1; i <= LOOKBACK_DAYS; i++) {
    const d = addDaysStr(todayStr, -i);
    if (!isScheduled(days, d)) continue;
    if (doneDates.has(d)) streak++;
    else break;
  }

  // Best streak since the habit started (or the lookback window).
  const earliest = created > addDaysStr(todayStr, -LOOKBACK_DAYS) ? created : addDaysStr(todayStr, -LOOKBACK_DAYS);
  let best = 0;
  let run = 0;
  for (let d = earliest; d <= todayStr; d = addDaysStr(d, 1)) {
    if (!isScheduled(days, d)) continue;
    if (doneDates.has(d)) {
      run++;
      best = Math.max(best, run);
    } else if (d !== todayStr) {
      run = 0;
    }
  }

  // Completion rate: due days in the last 30 (since it started). An open "today" isn't a miss yet.
  const windowStart = addDaysStr(todayStr, -29);
  const rateStart = created > windowStart ? created : windowStart;
  let due = 0;
  let done = 0;
  for (let d = rateStart; d <= todayStr; d = addDaysStr(d, 1)) {
    if (!isScheduled(days, d)) continue;
    if (d === todayStr && !doneDates.has(d)) continue;
    due++;
    if (doneDates.has(d)) done++;
  }

  const week: DayCell[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDaysStr(todayStr, -i);
    week.push({
      date: d,
      label: WEEKDAY_ABBR[weekdayOf(d)],
      scheduled: isScheduled(days, d),
      done: doneDates.has(d),
      isToday: d === todayStr,
    });
  }

  return { streak, best, rate30: due ? Math.round((done / due) * 100) : null, week, dueToday, doneToday };
}

export const HABIT_LOOKBACK_DAYS = LOOKBACK_DAYS;
