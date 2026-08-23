import Link from "next/link";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { Card, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { addEvent, deleteEvent } from "./actions";

type CalendarEvent = {
  id: string;
  title: string;
  location: string | null;
  start_at: string;
  all_day: boolean;
  color: string;
  recurrence: string;
  recurrence_end: string | null;
};

function advance(date: Date, frequency: string): Date {
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
function expandOccurrences(events: CalendarEvent[], rangeStart: Date, rangeEndExclusive: Date) {
  const result: (CalendarEvent & { occurrenceKey: string })[] = [];

  for (const e of events) {
    if (e.recurrence === "none") {
      result.push({ ...e, occurrenceKey: e.id });
      continue;
    }

    const recurrenceEnd = e.recurrence_end ? new Date(`${e.recurrence_end}T23:59:59`) : null;
    let occurrence = new Date(e.start_at);
    let guard = 0;

    while (occurrence < rangeEndExclusive && guard < 3660) {
      if (recurrenceEnd && occurrence > recurrenceEnd) break;
      if (occurrence >= rangeStart) {
        result.push({ ...e, start_at: occurrence.toISOString(), occurrenceKey: `${e.id}-${occurrence.toISOString()}` });
      }
      occurrence = advance(occurrence, e.recurrence);
      guard++;
    }
  }

  return result;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const household = await requireHousehold();
  const { month } = await searchParams;
  const anchor = month ? new Date(`${month}-01T00:00:00`) : new Date();

  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const gridEndExclusive = addDays(gridEnd, 1);

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("household_id", household.householdId)
    .lte("start_at", gridEndExclusive.toISOString())
    .or(`recurrence.neq.none,start_at.gte.${gridStart.toISOString()}`)
    .order("start_at");

  const occurrences = expandOccurrences((events ?? []) as CalendarEvent[], gridStart, gridEndExclusive);

  const eventsByDay = new Map<string, typeof occurrences>();
  for (const e of occurrences) {
    const key = e.start_at.slice(0, 10);
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key)!.push(e);
  }

  const prevMonth = format(subMonths(monthStart, 1), "yyyy-MM");
  const nextMonth = format(addMonths(monthStart, 1), "yyyy-MM");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Shared household schedule." />

      <Card className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Add an event</h2>
        <form action={addEvent} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input name="title" required placeholder="Event title" className={inputClass} />
          <input name="assigned_to" placeholder="Who (optional)" className={inputClass} />

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Date</label>
            <input name="date" type="date" required defaultValue={todayStr} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Time (leave blank for all-day)</label>
            <input name="time" type="time" className={inputClass} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Repeat</label>
            <select name="recurrence" defaultValue="none" className={inputClass}>
              <option value="none">Does not repeat</option>
              <option value="daily">Repeats daily</option>
              <option value="weekly">Repeats weekly</option>
              <option value="monthly">Repeats monthly</option>
              <option value="yearly">Repeats yearly (e.g. birthdays)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Repeat until (leave blank for forever)</label>
            <input name="recurrence_end" type="date" className={inputClass} />
          </div>

          <input name="location" placeholder="Location (optional)" className={`${inputClass} sm:col-span-2`} />
          <button type="submit" className={`${buttonClass} sm:col-span-2`}>
            Add event
          </button>
        </form>
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <Link href={`/calendar?month=${prevMonth}`} className="text-sm text-slate-500 hover:text-teal-600">
          ← Prev
        </Link>
        <h2 className="text-lg font-semibold text-slate-900">{format(monthStart, "MMMM yyyy")}</h2>
        <Link href={`/calendar?month=${nextMonth}`} className="text-sm text-slate-500 hover:text-teal-600">
          Next →
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-slate-50 p-2 text-center font-medium text-slate-500">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDay.get(key) ?? [];
          const inMonth = day.getMonth() === monthStart.getMonth();
          const isToday = key === todayStr;
          return (
            <div
              key={key}
              className={`min-h-24 p-1.5 ${isToday ? "bg-yellow-50" : "bg-white"} ${inMonth ? "" : "bg-slate-50 text-slate-300"}`}
            >
              <p className={`mb-1 text-right text-xs ${isToday ? "font-bold text-teal-600" : "text-slate-400"}`}>
                {format(day, "d")}
              </p>
              <div className="space-y-1">
                {dayEvents.map((e) => (
                  <form key={e.occurrenceKey} action={deleteEvent}>
                    <input type="hidden" name="id" value={e.id} />
                    <button
                      title={e.recurrence !== "none" ? "Click to remove this whole repeating series" : "Click to remove"}
                      className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white"
                      style={{ backgroundColor: e.color }}
                    >
                      {e.recurrence !== "none" ? "↻ " : ""}
                      {e.all_day ? "" : format(new Date(e.start_at), "h:mma ")}
                      {e.title}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
