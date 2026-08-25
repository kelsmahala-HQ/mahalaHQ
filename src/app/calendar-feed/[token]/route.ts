import { createAdminClient } from "@/lib/supabase/admin";

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function icsDateTime(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

// Event times are entered as household-local wall-clock time and stored the same way (this app
// doesn't do timezone conversion), so these digits ARE the intended Eastern time — tagging them
// TZID=America/New_York (see VTIMEZONE below) instead of leaving them "floating" is what's needed:
// Google Calendar doesn't reliably honor floating time on *subscribed* feeds and falls back to UTC.
function icsLocalDateTime(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
}

const VTIMEZONE_EASTERN = [
  "BEGIN:VTIMEZONE",
  "TZID:America/New_York",
  "X-LIC-LOCATION:America/New_York",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
].join("\r\n");

function icsDate(d: Date): string {
  return icsDateTime(d).slice(0, 8);
}

const FREQ_MAP: Record<string, string> = {
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  yearly: "YEARLY",
};

type CalEvent = {
  id: string;
  title: string;
  location: string | null;
  start_at: string;
  all_day: boolean;
  recurrence: string;
  recurrence_end: string | null;
  event_type: string;
};

function eventToVevents(e: CalEvent): string[] {
  const start = new Date(e.start_at);

  // Birthdays: standard RRULE can't compute "turns N" per occurrence, so generate
  // individual dated entries for the next 20 years with the age baked into each one.
  if (e.event_type === "birthday" && e.recurrence === "yearly") {
    const originYear = start.getFullYear();
    const vevents: string[] = [];
    for (let i = 0; i < 20; i++) {
      const occurrence = new Date(start);
      occurrence.setFullYear(originYear + i);
      const age = i;
      if (age <= 0) continue;
      const dtEnd = new Date(occurrence);
      dtEnd.setDate(dtEnd.getDate() + 1);
      vevents.push(
        [
          "BEGIN:VEVENT",
          `UID:${e.id}-${originYear + i}@familyportal`,
          `DTSTAMP:${icsDateTime(new Date())}`,
          `DTSTART;VALUE=DATE:${icsDate(occurrence)}`,
          `DTEND;VALUE=DATE:${icsDate(dtEnd)}`,
          `SUMMARY:${escapeIcs(`🎂 ${e.title} (turns ${age})`)}`,
          "END:VEVENT",
        ].join("\r\n")
      );
    }
    return vevents;
  }

  const lines = ["BEGIN:VEVENT", `UID:${e.id}@familyportal`, `DTSTAMP:${icsDateTime(new Date())}`];

  if (e.all_day) {
    const dtEnd = new Date(start);
    dtEnd.setDate(dtEnd.getDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${icsDate(start)}`, `DTEND;VALUE=DATE:${icsDate(dtEnd)}`);
  } else {
    lines.push(`DTSTART;TZID=America/New_York:${icsLocalDateTime(start)}`);
  }

  lines.push(`SUMMARY:${escapeIcs(e.title)}`);
  if (e.location) lines.push(`LOCATION:${escapeIcs(e.location)}`);

  if (e.recurrence !== "none" && FREQ_MAP[e.recurrence]) {
    let rrule = `RRULE:FREQ=${FREQ_MAP[e.recurrence]}`;
    if (e.recurrence_end) rrule += `;UNTIL=${icsDate(new Date(`${e.recurrence_end}T23:59:59`))}T235959Z`;
    lines.push(rrule);
  }

  lines.push("END:VEVENT");
  return [lines.join("\r\n")];
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const admin = createAdminClient();

  const { data: household } = await admin
    .from("households")
    .select("id, name")
    .eq("calendar_feed_token", token)
    .maybeSingle();

  if (!household) {
    return new Response("Not found", { status: 404 });
  }

  const { data: events } = await admin
    .from("calendar_events")
    .select("id, title, location, start_at, all_day, recurrence, recurrence_end, event_type")
    .eq("household_id", household.id);

  const vevents = (events ?? []).flatMap((e) => eventToVevents(e as CalEvent));

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mahala HQ//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcs(household.name)}`,
    "X-WR-TIMEZONE:America/New_York",
    VTIMEZONE_EASTERN,
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
