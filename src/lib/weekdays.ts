export const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
] as const;

export const WEEKDAY_ABBR = WEEKDAYS.map((d) => d.label);

/** For a weekly recurrence pinned to specific days, formats them as e.g. "Mon/Wed/Fri". */
export function daysOfWeekLabel(daysOfWeek: number[] | null | undefined): string | null {
  if (!daysOfWeek?.length) return null;
  return daysOfWeek
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_ABBR[d])
    .join("/");
}

/** Jumps forward from `date` to the next date whose weekday is in daysOfWeek (up to 2 weeks
 *  out, which always finds one). Used to advance a weekly recurrence pinned to specific days
 *  instead of a flat +7. */
export function nextMatchingWeekday(date: Date, daysOfWeek: number[]): Date {
  for (let i = 1; i <= 14; i++) {
    const candidate = new Date(date);
    candidate.setDate(candidate.getDate() + i);
    if (daysOfWeek.includes(candidate.getDay())) return candidate;
  }
  return date;
}
