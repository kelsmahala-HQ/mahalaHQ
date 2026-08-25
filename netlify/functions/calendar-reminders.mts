import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { expandOccurrences, type CalendarEvent } from "../../src/lib/calendar-agenda";
import { sendPushToHousehold, sendPushToMember } from "../../src/lib/push";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TWO_HOUR_MS = 2 * 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000; // matches this function's own cron cadence

// Same U.S. Eastern DST rule as the ICS feed's VTIMEZONE block (2nd Sunday of March -
// 1st Sunday of November). Event times are stored as Eastern wall-clock digits (no real
// timezone conversion happens elsewhere in the app), so this is what turns those digits
// into a real UTC instant we can compare against the actual current time.
function nthSundayOfMonth(year: number, month1: number, n: number): number {
  const first = new Date(Date.UTC(year, month1 - 1, 1));
  const firstSunday = 1 + ((7 - first.getUTCDay()) % 7);
  return firstSunday + (n - 1) * 7;
}

function easternOffsetHours(year: number, month1: number, day: number): number {
  if (month1 < 3 || month1 > 11) return 5; // EST
  if (month1 > 3 && month1 < 11) return 4; // EDT
  const boundaryDay = month1 === 3 ? nthSundayOfMonth(year, 3, 2) : nthSundayOfMonth(year, 11, 1);
  if (month1 === 3) return day >= boundaryDay ? 4 : 5;
  return day < boundaryDay ? 4 : 5;
}

/** The stored digits ARE Eastern wall-clock time -- converts them to the real UTC instant. */
function toRealUtcMs(isoString: string): number {
  const d = new Date(isoString);
  const offset = easternOffsetHours(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()) + offset * 3600000;
}

function formatEasternTime(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

async function calendarReminders() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY!;
  const admin = createClient(supabaseUrl, supabaseKey);

  const now = Date.now();
  // Widest possible window we could need reminders for on this tick, plus slack.
  const rangeStart = new Date(now);
  const rangeEndExclusive = new Date(now + ONE_DAY_MS + WINDOW_MS);

  const { data: households } = await admin.from("households").select("id");

  for (const household of households ?? []) {
    const { data: events } = await admin
      .from("calendar_events")
      .select("*")
      .eq("household_id", household.id)
      .eq("all_day", false)
      .lte("start_at", rangeEndExclusive.toISOString())
      .or(`recurrence.neq.none,start_at.gte.${rangeStart.toISOString()}`);

    if (!events?.length) continue;

    const occurrences = expandOccurrences(events as CalendarEvent[], rangeStart, rangeEndExclusive);

    for (const occurrence of occurrences) {
      const startMs = toRealUtcMs(occurrence.start_at);
      const msUntil = startMs - now;

      const dueTypes: { type: "1day" | "2hr"; label: string }[] = [];
      if (msUntil > ONE_DAY_MS - WINDOW_MS && msUntil <= ONE_DAY_MS) dueTypes.push({ type: "1day", label: "Tomorrow" });
      if (msUntil > TWO_HOUR_MS - WINDOW_MS && msUntil <= TWO_HOUR_MS) dueTypes.push({ type: "2hr", label: "In 2 hours" });
      if (!dueTypes.length) continue;

      for (const due of dueTypes) {
        const { error: insertError } = await admin.from("calendar_event_reminders_sent").insert({
          event_id: occurrence.id,
          occurrence_start_at: occurrence.start_at,
          reminder_type: due.type,
        });
        if (insertError) continue; // already sent (unique violation) or a real error -- either way, skip

        const time = formatEasternTime(occurrence.start_at);
        const payload = {
          title: `📅 ${occurrence.title}`,
          body: `${due.label} at ${time}${occurrence.location ? ` — ${occurrence.location}` : ""}`,
          url: `/calendar/day?date=${occurrence.start_at.slice(0, 10)}`,
        };

        if (occurrence.assigned_member_id) {
          await sendPushToMember(admin, occurrence.assigned_member_id, payload);
        } else {
          await sendPushToHousehold(admin, household.id, payload);
        }
      }
    }
  }
}

export default calendarReminders;

export const config: Config = {
  schedule: "*/15 * * * *",
};
