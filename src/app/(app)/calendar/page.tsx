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
import { Card, PageHeader } from "@/components/ui";
import { deleteEvent, updateEvent, updateGoogleCalendarUrl } from "./actions";
import FeedLink from "./feed-link";
import EventPill from "./event-pill";
import GoogleImportForm from "./google-import-form";
import AddEventForm from "./add-event-form";
import { fetchExternalEvents } from "@/lib/ics-import";

type CalendarEvent = {
  id: string;
  title: string;
  location: string | null;
  assigned_to: string | null;
  assigned_member_id: string | null;
  start_at: string;
  all_day: boolean;
  color: string;
  recurrence: string;
  recurrence_end: string | null;
  event_type: string;
};

const EVENT_TYPE_ICONS: Record<string, string> = {
  birthday: "🎂",
  appointment: "🏥",
  holiday: "🎉",
  school: "🏫",
  general: "",
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

type BillDue = { key: string; name: string; source: "debt" | "bill" };

/** Synthesizes "bill due" entries from debts' due_day/due_weekday for days in the visible grid. */
function billsDueByDay(debts: { name: string; payment_frequency: string; due_day: number | null; due_weekday: number | null }[], days: Date[]) {
  const map = new Map<string, BillDue[]>();
  for (const day of days) {
    const key = format(day, "yyyy-MM-dd");
    for (const d of debts) {
      const isDue =
        d.payment_frequency === "monthly" ? d.due_day === day.getDate() : d.due_weekday === day.getDay();
      if (!isDue) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ key: `${key}-debt-${d.name}`, name: d.name, source: "debt" });
    }
  }
  return map;
}

function advanceBill(date: Date, frequency: string): Date {
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
function billsTableDueByDay(bills: { name: string; frequency: string; due_date: string }[], gridStart: Date, gridEndExclusive: Date) {
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

function mergeBillMaps(a: Map<string, BillDue[]>, b: Map<string, BillDue[]>) {
  for (const [key, items] of b) {
    if (!a.has(key)) a.set(key, []);
    a.get(key)!.push(...items);
  }
  return a;
}

type ChoreDue = { key: string; title: string; assigned_to: string | null };

/** Open chores with a due_date, one pill on that single date — chores don't auto-generate future occurrences. */
function choresDueByDay(chores: { id: string; title: string; assigned_to: string | null; due_date: string | null; status: string }[]) {
  const map = new Map<string, ChoreDue[]>();
  for (const c of chores) {
    if (c.status === "done" || !c.due_date) continue;
    const key = c.due_date;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push({ key: `${key}-chore-${c.id}`, title: c.title, assigned_to: c.assigned_to });
  }
  return map;
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
  const canSeeMoney = household.role === "admin" || household.role === "adult";
  const isKid = household.role === "kid";
  const [{ data: events }, { data: debts }, { data: billsTable }, { data: chores }, { data: familyMembers }, external] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("*")
      .eq("household_id", household.householdId)
      .lte("start_at", gridEndExclusive.toISOString())
      .or(`recurrence.neq.none,start_at.gte.${gridStart.toISOString()}`)
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
    household.googleCalendarUrl
      ? fetchExternalEvents(household.googleCalendarUrl, gridStart, gridEndExclusive)
      : Promise.resolve({ occurrences: [], error: null }),
  ]);

  const members = familyMembers ?? [];

  const occurrences = expandOccurrences((events ?? []) as CalendarEvent[], gridStart, gridEndExclusive);
  const bills = mergeBillMaps(billsDueByDay(debts ?? [], days), billsTableDueByDay(billsTable ?? [], gridStart, gridEndExclusive));
  const choresByDay = choresDueByDay(chores ?? []);

  const externalByDay = new Map<string, typeof external.occurrences>();
  for (const ext of external.occurrences) {
    const key = format(ext.startAt, "yyyy-MM-dd");
    if (!externalByDay.has(key)) externalByDay.set(key, []);
    externalByDay.get(key)!.push(ext);
  }

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
        <AddEventForm todayStr={todayStr} members={members} />
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
          const dayBills = bills.get(key) ?? [];
          const dayChores = choresByDay.get(key) ?? [];
          const dayExternal = externalByDay.get(key) ?? [];
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
                {dayBills.map((b) => (
                  <Link
                    key={b.key}
                    href={b.source === "debt" ? "/debts" : "/budget"}
                    title={`Bill due — click to open ${b.source === "debt" ? "Debts" : "Budget"}`}
                    className="block truncate rounded bg-red-500 px-1.5 py-0.5 text-left text-[11px] font-medium text-white"
                  >
                    💳 {b.name} due
                  </Link>
                ))}
                {dayChores.map((c) => (
                  <Link
                    key={c.key}
                    href="/chores"
                    title={`Chore due — click to open Chores${c.assigned_to ? ` (${c.assigned_to})` : ""}`}
                    className="block truncate rounded bg-yellow-500 px-1.5 py-0.5 text-left text-[11px] font-medium text-white"
                  >
                    🧹 {c.title}
                  </Link>
                ))}
                {dayExternal.map((ext) => (
                  <p
                    key={ext.key}
                    title={`From your Google Calendar${ext.allDay ? "" : ` — ${format(ext.startAt, "h:mma")}`}`}
                    className="block truncate rounded bg-blue-500 px-1.5 py-0.5 text-left text-[11px] font-medium text-white"
                  >
                    {ext.allDay ? "" : `${format(ext.startAt, "h:mma")} `}
                    {ext.title}
                  </p>
                ))}
                {dayEvents.map((e) => (
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
            </div>
          );
        })}
      </div>

      {(household.role === "admin" || household.role === "adult") && (
        <Card className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">📅 Sync to Google Calendar</h2>
          <p className="mb-3 text-xs text-slate-500">
            In Google Calendar: <strong>Other calendars → From URL</strong>, paste this link. Google refreshes
            subscribed calendars every several hours, not instantly — and this also feeds Alexa if your Google
            account is linked to it. Bill due dates aren&rsquo;t included in the feed to keep balance info private
            outside the app.
          </p>
          <FeedLink token={household.calendarFeedToken} />
        </Card>
      )}

      {(household.role === "admin" || household.role === "adult") && (
        <Card className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">📥 Import from Google Calendar</h2>
          <p className="mb-3 text-xs text-slate-500">
            In Google Calendar: <strong>Settings → your calendar → Integrate calendar</strong>, copy the{" "}
            <strong>Secret address in iCal format</strong>, and paste it below. Those events show up here in blue,
            read-only — checked about once an hour. Only basic daily/weekly/monthly/yearly repeats are understood;
            unusual custom repeats may not show every occurrence.
          </p>
          <GoogleImportForm currentUrl={household.googleCalendarUrl} action={updateGoogleCalendarUrl} />
          {external.error && <p className="mt-2 text-xs text-red-500">{external.error}</p>}
        </Card>
      )}
    </div>
  );
}
