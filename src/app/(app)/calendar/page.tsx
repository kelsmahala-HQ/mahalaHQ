import Link from "next/link";
import {
  addDays,
  addMonths,
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

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("household_id", household.householdId)
    .gte("start_at", gridStart.toISOString())
    .lte("start_at", addDays(gridEnd, 1).toISOString())
    .order("start_at");

  const eventsByDay = new Map<string, typeof events>();
  for (const e of events ?? []) {
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
          <input name="date" type="date" required defaultValue={todayStr} className={inputClass} />
          <input name="time" type="time" className={inputClass} />
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
                  <form key={e.id} action={deleteEvent}>
                    <input type="hidden" name="id" value={e.id} />
                    <button
                      title="Click to remove"
                      className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white"
                      style={{ backgroundColor: e.color }}
                    >
                      {e.all_day ? "" : format(new Date(e.start_at), "h:mma ") }
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
