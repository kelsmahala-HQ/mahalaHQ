import Link from "next/link";
import { addDays, addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { Card, CollapsibleCard, PageHeader, buttonClass } from "@/components/ui";
import { deleteEvent, updateEvent, updateGoogleCalendarUrl } from "./actions";
import FeedLink from "./feed-link";
import EventPill from "./event-pill";
import GoogleImportForm from "./google-import-form";
import AddEventForm from "./add-event-form";
import { fetchExternalEvents } from "@/lib/ics-import";
import { EVENT_TYPE_ICONS } from "./event-types";
import {
  type CalendarEvent,
  billsDueByDay,
  billsTableDueByDay,
  choresDueByDay,
  expandOccurrences,
  mergeBillMaps,
} from "@/lib/calendar-agenda";
import FilterBar, { parseHidden } from "./filter-bar";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; hide?: string; add?: string }>;
}) {
  const household = await requireHousehold();
  const { month, hide, add } = await searchParams;
  const hidden = parseHidden(hide);
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
  const addEventDate = add && /^\d{4}-\d{2}-\d{2}$/.test(add) ? add : todayStr;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Calendar" subtitle="Shared household schedule." />
        <Link href={`/calendar/day?date=${todayStr}`} className={`${buttonClass} shrink-0`}>
          📋 Open Day Planner →
        </Link>
      </div>

      <div id="add-event">
        <CollapsibleCard
          title={
            <span className="flex items-center gap-2">
              Add an event
              {add && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">{addEventDate}</span>}
            </span>
          }
          defaultOpen={!!add}
          className="mb-4 sm:mb-8"
        >
          <AddEventForm todayStr={addEventDate} members={members} />
        </CollapsibleCard>
      </div>

      <div className="mb-3 flex items-center justify-between sm:mb-4">
        <Link href={`/calendar?month=${prevMonth}${hide ? `&hide=${hide}` : ""}`} className="text-sm text-slate-500 hover:text-teal-600">
          ← Prev
        </Link>
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{format(monthStart, "MMMM yyyy")}</h2>
        <Link href={`/calendar?month=${nextMonth}${hide ? `&hide=${hide}` : ""}`} className="text-sm text-slate-500 hover:text-teal-600">
          Next →
        </Link>
      </div>

      <FilterBar basePath="/calendar" extraParams={month ? { month } : {}} hidden={hidden} />

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-slate-50 p-1 text-center font-medium text-slate-500 sm:p-2">
            <span className="sm:hidden">{d.slice(0, 1)}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = (eventsByDay.get(key) ?? []).filter((e) => !hidden.has(e.event_type));
          const dayBills = hidden.has("bills") ? [] : (bills.get(key) ?? []);
          const dayChores = hidden.has("chores") ? [] : (choresByDay.get(key) ?? []);
          const dayExternal = hidden.has("external") ? [] : (externalByDay.get(key) ?? []);
          const inMonth = day.getMonth() === monthStart.getMonth();
          const isToday = key === todayStr;
          const addParams = new URLSearchParams();
          if (month) addParams.set("month", month);
          if (hide) addParams.set("hide", hide);
          addParams.set("add", key);
          const dots: { className?: string; style?: React.CSSProperties; title: string }[] = [
            ...dayBills.map((b) => ({ className: "bg-rose-300", title: `💳 ${b.name} due` })),
            ...dayChores.map((c) => ({ className: "bg-amber-300", title: `🧹 ${c.title}` })),
            ...dayExternal.map((ext) => ({ className: "bg-sky-300", title: ext.title })),
            ...dayEvents.map((e) => ({ style: { backgroundColor: e.color }, title: e.title })),
          ];
          return (
            <div
              key={key}
              className={`min-h-11 p-1 sm:min-h-24 sm:p-1.5 ${isToday ? "bg-yellow-50" : "bg-white"} ${inMonth ? "" : "bg-slate-50 text-slate-300"}`}
            >
              <div className="flex items-center justify-between sm:mb-1">
                <Link
                  href={`/calendar?${addParams.toString()}#add-event`}
                  title="Add something on this day"
                  className="rounded px-1 text-[11px] font-bold leading-none text-slate-300 hover:bg-teal-50 hover:text-teal-600 sm:px-1.5 sm:py-0.5 sm:text-xs"
                >
                  +
                </Link>
                <Link
                  href={`/calendar/day?date=${key}`}
                  title="Open day view"
                  className={`px-1 py-0.5 text-right text-[11px] hover:underline sm:text-xs ${isToday ? "font-bold text-teal-600" : "text-slate-400"}`}
                >
                  {format(day, "d")}
                </Link>
              </div>

              {/* Mobile: compact dots instead of cramped text pills — tap the date above for full detail. */}
              {!!dots.length && (
                <div className="flex flex-wrap items-center justify-center gap-0.5 sm:hidden">
                  {dots.slice(0, 5).map((d, i) => (
                    <span key={i} title={d.title} className={`h-1 w-1 shrink-0 rounded-full ${d.className ?? ""}`} style={d.style} />
                  ))}
                  {dots.length > 5 && <span className="text-[9px] leading-none text-slate-400">+{dots.length - 5}</span>}
                </div>
              )}

              <div className="hidden space-y-1 sm:block">
                {dayBills.map((b) => (
                  <Link
                    key={b.key}
                    href={b.source === "debt" ? "/debts" : "/budget"}
                    title={`Bill due — click to open ${b.source === "debt" ? "Debts" : "Budget"}`}
                    className="block truncate rounded bg-rose-200 px-1.5 py-0.5 text-left text-[11px] font-medium text-rose-900"
                  >
                    💳 {b.name} due
                  </Link>
                ))}
                {dayChores.map((c) => (
                  <Link
                    key={c.key}
                    href="/chores"
                    title={`Chore due — click to open Chores${c.assigned_to ? ` (${c.assigned_to})` : ""}`}
                    className="block truncate rounded bg-amber-200 px-1.5 py-0.5 text-left text-[11px] font-medium text-amber-900"
                  >
                    🧹 {c.title}
                  </Link>
                ))}
                {dayExternal.map((ext) => (
                  <p
                    key={ext.key}
                    title={`From your Google Calendar${ext.allDay ? "" : ` — ${format(ext.startAt, "h:mma")}`}`}
                    className="block truncate rounded bg-sky-200 px-1.5 py-0.5 text-left text-[11px] font-medium text-sky-900"
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
            read-only — checked about every 10 minutes. Only basic daily/weekly/monthly/yearly repeats are understood;
            unusual custom repeats may not show every occurrence.
          </p>
          <GoogleImportForm currentUrl={household.googleCalendarUrl} action={updateGoogleCalendarUrl} />
          {external.error && <p className="mt-2 text-xs text-red-500">{external.error}</p>}
        </Card>
      )}
    </div>
  );
}
