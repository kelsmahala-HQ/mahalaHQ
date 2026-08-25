import { addDays, addMonths, addWeeks, addYears, format } from "date-fns";

export type CalendarEvent = {
  id: string;
  title: string;
  location: string | null;
  assigned_to: string | null;
  assigned_member_id: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  color: string;
  recurrence: string;
  recurrence_end: string | null;
  event_type: string;
};

export function advance(date: Date, frequency: string): Date {
  switch (frequency) {
    case "daily":
      return addDays(date, 1);
    case "weekly":
      return addWeeks(date, 1);
    case "monthly":
      return addMonths(date, 1);
    case "yearly":
      return addYears(date, 1);
    default:
      return date;
  }
}

/** Expands recurring events into individual occurrences that fall within [rangeStart, rangeEndExclusive). */
export function expandOccurrences(events: CalendarEvent[], rangeStart: Date, rangeEndExclusive: Date) {
  const result: (CalendarEvent & { occurrenceKey: string; age: number | null; anchorStartAt: string })[] = [];

  for (const e of events) {
    const originYear = new Date(e.start_at).getFullYear();

    if (e.recurrence === "none") {
      result.push({ ...e, occurrenceKey: e.id, age: null, anchorStartAt: e.start_at });
      continue;
    }

    const recurrenceEnd = e.recurrence_end ? new Date(`${e.recurrence_end}T23:59:59`) : null;
    let occurrence = new Date(e.start_at);
    let guard = 0;

    while (occurrence < rangeEndExclusive && guard < 3660) {
      if (recurrenceEnd && occurrence > recurrenceEnd) break;
      if (occurrence >= rangeStart) {
        const age = e.event_type === "birthday" ? occurrence.getFullYear() - originYear : null;
        result.push({
          ...e,
          start_at: occurrence.toISOString(),
          occurrenceKey: `${e.id}-${occurrence.toISOString()}`,
          age: age && age > 0 ? age : null,
          anchorStartAt: e.start_at,
        });
      }
      occurrence = advance(occurrence, e.recurrence);
      guard++;
    }
  }

  return result;
}

export type BillDue = { key: string; name: string; source: "debt" | "bill" };

/** Synthesizes "bill due" entries from debts' due_day/due_weekday for days in the visible grid. */
export function billsDueByDay(
  debts: { name: string; payment_frequency: string; due_day: number | null; due_weekday: number | null }[],
  days: Date[]
) {
  const map = new Map<string, BillDue[]>();
  for (const day of days) {
    const key = format(day, "yyyy-MM-dd");
    for (const d of debts) {
      const isDue = d.payment_frequency === "monthly" ? d.due_day === day.getDate() : d.due_weekday === day.getDay();
      if (!isDue) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ key: `${key}-debt-${d.name}`, name: d.name, source: "debt" });
    }
  }
  return map;
}

export function advanceBill(date: Date, frequency: string): Date {
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

/** Synthesizes "bill due" entries from the Budget page's bills table for days in the visible grid. */
export function billsTableDueByDay(bills: { name: string; frequency: string; due_date: string }[], gridStart: Date, gridEndExclusive: Date) {
  const map = new Map<string, BillDue[]>();
  for (const b of bills) {
    let occurrence = new Date(`${b.due_date}T00:00:00`);
    let guard = 0;
    while (occurrence < gridEndExclusive && guard < 500) {
      if (occurrence >= gridStart) {
        const key = format(occurrence, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ key: `${key}-bill-${b.name}`, name: b.name, source: "bill" });
      }
      if (b.frequency === "once") break;
      occurrence = advanceBill(occurrence, b.frequency);
      guard++;
    }
  }
  return map;
}

export function mergeBillMaps(a: Map<string, BillDue[]>, b: Map<string, BillDue[]>) {
  for (const [key, items] of b) {
    if (!a.has(key)) a.set(key, []);
    a.get(key)!.push(...items);
  }
  return a;
}

export type ChoreDue = { key: string; title: string; assigned_to: string | null };

/** Open chores with a due_date, one pill on that single date — chores don't auto-generate future occurrences. */
export function choresDueByDay(chores: { id: string; title: string; assigned_to: string | null; due_date: string | null; status: string }[]) {
  const map = new Map<string, ChoreDue[]>();
  for (const c of chores) {
    if (c.status === "done" || !c.due_date) continue;
    const key = c.due_date;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push({ key: `${key}-chore-${c.id}`, title: c.title, assigned_to: c.assigned_to });
  }
  return map;
}
