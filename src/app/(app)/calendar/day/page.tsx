import Link from "next/link";
import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { Card, PageHeader } from "@/components/ui";
import { deleteEvent, updateEvent } from "../actions";
import EventPill from "../event-pill";
import AddEventForm from "../add-event-form";
import { EVENT_TYPE_ICONS } from "../event-types";
import { wallClockDate } from "@/lib/wall-clock";
import {
  type CalendarEvent,
  billsDueByDay,
  billsTableDueByDay,
  choresDueByDay,
  expandOccurrences,
  mergeBillMaps,
} from "@/lib/calendar-agenda";
import TaskList from "./task-list";
import QuickAddHour from "./quick-add-hour";

const HOUR_START = 6; // 6am
const HOUR_END = 22; // 10pm row (last row covers 10-11pm)
const DEFAULT_SPAN_MINUTES = 60; // fallback highlight span when an event has no end time
const BABYSITTER_DEFAULT_MINUTES = 180; // babysitter blocks default to a longer span

function hourLabel(hour: number) {
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${period}`;
}

function minutesOfDay(iso: string) {
  const d = wallClockDate(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export default async function DayPlannerPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const household = await requireHousehold();
  const { date } = await searchParams;
  const dayStr = date || format(new Date(), "yyyy-MM-dd");
  const dayStart = new Date(`${dayStr}T00:00:00`);
  const dayEndExclusive = addDays(dayStart, 1);

  const supabase = await createClient();
  const canSeeMoney = household.role === "admin" || household.role === "adult";
  const isKid = household.role === "kid";

  const [{ data: events }, { data: debts }, { data: billsTable }, { data: chores }, { data: familyMembers }, { data: tasks }] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("*")
      .eq("household_id", household.householdId)
      .lte("start_at", dayEndExclusive.toISOString())
      .or(`recurrence.neq.none,start_at.gte.${dayStart.toISOString()}`)
      .order("start_at"),
    canSeeMoney
      ? supabase
          .from("debts")
          .select("name, payment_frequency, due_day, due_weekday")
          .eq("household_id", household.householdId)
          .or("due_day.not.is.null,due_weekday.not.is.null")
      : Promise.resolve({ data: [] }),
    canSeeMoney
      ? supabase.from("bills").select("name, frequency, due_date").eq("household_id", household.householdId)
      : Promise.resolve({ data: [] }),
    (() => {
      let query = supabase
        .from("chores")
        .select("id, title, assigned_to, assigned_member_id, due_date, status")
        .eq("household_id", household.householdId)
        .not("due_date", "is", null);
      if (isKid) query = query.eq("assigned_member_id", household.memberId);
      return query;
    })(),
    supabase.from("family_profiles").select("id, member_name").eq("household_id", household.householdId).order("member_name"),
    supabase
      .from("day_planner_tasks")
      .select("id, kind, text, is_done")
      .eq("household_id", household.householdId)
      .eq("date", dayStr)
      .order("created_at"),
  ]);

  const todoTasks = (tasks ?? []).filter((t) => t.kind === "todo");
  const followupTasks = (tasks ?? []).filter((t) => t.kind === "followup");

  const members = familyMembers ?? [];
  const occurrences = expandOccurrences((events ?? []) as CalendarEvent[], dayStart, dayEndExclusive);
  const bills = mergeBillMaps(billsDueByDay(debts ?? [], [dayStart]), billsTableDueByDay(billsTable ?? [], dayStart, dayEndExclusive));
  const choresByDay = choresDueByDay(chores ?? []);
  const dayBills = bills.get(dayStr) ?? [];
  const dayChores = choresByDay.get(dayStr) ?? [];

  const allDayEvents = occurrences.filter((e) => e.all_day);
  const timedEvents = occurrences.filter((e) => !e.all_day);
  const highlightedEvents = timedEvents.filter((e) => e.highlight_color);

  const hours: number[] = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) hours.push(h);

  function coversHour(e: (typeof timedEvents)[number], hour: number) {
    const startMin = minutesOfDay(e.start_at);
    const fallback = e.event_type === "babysitter" ? BABYSITTER_DEFAULT_MINUTES : DEFAULT_SPAN_MINUTES;
    const endMin = e.end_at ? minutesOfDay(e.end_at) : startMin + fallback;
    const hourStartMin = hour * 60;
    const hourEndMin = hourStartMin + 60;
    return startMin < hourEndMin && endMin > hourStartMin;
  }

  const eventsByHour = new Map<number, typeof timedEvents>();
  for (const e of timedEvents) {
    const h = Math.min(HOUR_END, Math.max(HOUR_START, Math.floor(minutesOfDay(e.start_at) / 60)));
    if (!eventsByHour.has(h)) eventsByHour.set(h, []);
    eventsByHour.get(h)!.push(e);
  }

  const prevDay = format(addDays(dayStart, -1), "yyyy-MM-dd");
  const nextDay = format(addDays(dayStart, 1), "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const monthParam = format(dayStart, "yyyy-MM");

  return (
    <div>
      <PageHeader title="Day Planner" subtitle={format(dayStart, "EEEE, MMMM d, yyyy")} />

      <div className="mb-6 flex items-center justify-between">
        <Link href={`/calendar/day?date=${prevDay}`} className="text-sm font-medium text-slate-500 hover:text-teal-600">
          ← Prev day
        </Link>
        <div className="flex items-center gap-3">
          {dayStr !== todayStr && (
            <Link href={`/calendar/day?date=${todayStr}`} className="text-xs font-medium text-teal-600 hover:underline">
              Today
            </Link>
          )}
          <Link href={`/calendar?month=${monthParam}`} className="text-sm font-medium text-teal-600 hover:underline">
            Month view
          </Link>
        </div>
        <Link href={`/calendar/day?date=${nextDay}`} className="text-sm font-medium text-slate-500 hover:text-teal-600">
          Next day →
        </Link>
      </div>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Add to this day</h2>
        <AddEventForm todayStr={dayStr} members={members} />
      </Card>

      {(dayBills.length > 0 || dayChores.length > 0) && (
        <Card className="mb-6 !bg-amber-50">
          <p className="mb-2 text-xs font-semibold uppercase text-amber-700">Also due today</p>
          <div className="flex flex-wrap gap-2">
            {dayBills.map((b) => (
              <Link
                key={b.key}
                href={b.source === "debt" ? "/debts" : "/budget"}
                className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white"
              >
                💳 {b.name} due
              </Link>
            ))}
            {dayChores.map((c) => (
              <Link key={c.key} href="/chores" className="rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-medium text-white">
                🧹 {c.title}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">✅ To-Do</h2>
          <TaskList date={dayStr} kind="todo" tasks={todoTasks} />
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">📞 Follow-up Calls / Emails</h2>
          <TaskList date={dayStr} kind="followup" tasks={followupTasks} />
        </Card>
      </div>

      {allDayEvents.length > 0 && (
        <Card className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-400">All day</p>
          <div className="space-y-1">
            {allDayEvents.map((e) => (
              <EventPill
                key={e.occurrenceKey}
                event={e}
                icon={EVENT_TYPE_ICONS[e.event_type] ?? ""}
                members={members}
                deleteEvent={deleteEvent}
                updateEvent={updateEvent}
              />
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden !p-0">
        <div className="divide-y divide-slate-100">
          {hours.map((hour) => {
            const hourEvents = eventsByHour.get(hour) ?? [];
            const highlightsHere = highlightedEvents.filter((e) => coversHour(e, hour));
            const rowColor = highlightsHere[0]?.highlight_color ?? undefined;
            return (
              <div key={hour} className="flex min-h-14" style={rowColor ? { backgroundColor: rowColor } : undefined}>
                <div className="w-16 shrink-0 border-r border-slate-100 px-2 py-1.5 text-right text-xs text-slate-400">
                  {hourLabel(hour)}
                </div>
                <div className="flex-1 space-y-1 px-2 py-1.5">
                  {hourEvents.map((e) => (
                    <EventPill
                      key={e.occurrenceKey}
                      event={e}
                      icon={EVENT_TYPE_ICONS[e.event_type] ?? ""}
                      members={members}
                      deleteEvent={deleteEvent}
                      updateEvent={updateEvent}
                    />
                  ))}
                  <QuickAddHour date={dayStr} hour={`${String(hour).padStart(2, "0")}:00`} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
