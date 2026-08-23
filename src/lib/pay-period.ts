import { addMonths, addWeeks, addYears, eachWeekOfInterval, format } from "date-fns";

// Pay periods run Friday -> Thursday: payday is the FIRST day of the period, so that
// Friday's paycheck funds everything due from that Friday through the following Thursday.
export const PAY_PERIOD_OPTS = { weekStartsOn: 5 as const };

export function advance(date: Date, frequency: string): Date {
  switch (frequency) {
    case "weekly":
      return addWeeks(date, 1);
    case "biweekly":
      return addWeeks(date, 2);
    case "monthly":
      return addMonths(date, 1);
    case "quarterly":
      return addMonths(date, 3);
    case "semiannual":
      return addMonths(date, 6);
    case "yearly":
      return addYears(date, 1);
    default:
      return date; // 'once'
  }
}

export function regress(date: Date, frequency: string): Date {
  switch (frequency) {
    case "weekly":
      return addWeeks(date, -1);
    case "biweekly":
      return addWeeks(date, -2);
    case "monthly":
      return addMonths(date, -1);
    case "quarterly":
      return addMonths(date, -3);
    case "semiannual":
      return addMonths(date, -6);
    case "yearly":
      return addYears(date, -1);
    default:
      return date; // 'once'
  }
}

/** Finds the single occurrence date of this bill that lands within [periodStart, periodEnd], if any. */
export function occurrenceInPeriod(
  bill: { due_date: string; frequency: string },
  periodStart: Date,
  periodEnd: Date
): Date | null {
  if (bill.frequency === "once") {
    const d = new Date(`${bill.due_date}T00:00:00`);
    return d >= periodStart && d <= periodEnd ? d : null;
  }

  let occurrence = new Date(`${bill.due_date}T00:00:00`);
  let guard = 0;

  // The anchor is just "a" occurrence, not necessarily the first ever -- walk backward past
  // it if it's in a later period, then forward to the first one in range.
  while (occurrence > periodEnd && guard < 500) {
    occurrence = regress(occurrence, bill.frequency);
    guard++;
  }
  guard = 0;
  while (occurrence < periodStart && guard < 500) {
    occurrence = advance(occurrence, bill.frequency);
    guard++;
  }

  return occurrence >= periodStart && occurrence <= periodEnd ? occurrence : null;
}

/** Every pay-period week whose starting Friday falls within [monthStart, monthEnd]. */
export function weeksInMonth(monthStart: Date, monthEnd: Date): Date[] {
  return eachWeekOfInterval({ start: monthStart, end: monthEnd }, PAY_PERIOD_OPTS).filter((f) => f >= monthStart);
}

export type Reschedule = { bill_id: string; original_due_date: string; moved_to_week_start: string };

/**
 * Applies bill_reschedules overrides to a natural per-period occurrence list: drops occurrences
 * moved OUT of this week, and injects occurrences moved IN from elsewhere (using each bill's
 * original due date for display, but the target week for payment lookups).
 */
export function applyReschedules<T extends { id: string; due_date: string; frequency: string }>(
  bills: T[],
  naturalThisPeriod: (T & { occurrence: Date })[],
  reschedules: Reschedule[],
  periodStart: Date
): (T & { occurrence: Date; moved: boolean })[] {
  const periodStartStr = format(periodStart, "yyyy-MM-dd");
  const movedOutKeys = new Set(reschedules.map((r) => `${r.bill_id}-${r.original_due_date}`));

  const kept = naturalThisPeriod
    .filter((b) => !movedOutKeys.has(`${b.id}-${format(b.occurrence, "yyyy-MM-dd")}`))
    .map((b) => ({ ...b, moved: false }));

  const movedIn = reschedules
    .filter((r) => r.moved_to_week_start === periodStartStr)
    .map((r) => {
      const bill = bills.find((b) => b.id === r.bill_id);
      if (!bill) return null;
      return { ...bill, occurrence: new Date(`${r.original_due_date}T00:00:00`), moved: true };
    })
    .filter((b): b is T & { occurrence: Date; moved: boolean } => b !== null);

  return [...kept, ...movedIn].sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime());
}
