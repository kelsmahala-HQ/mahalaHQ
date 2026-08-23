import { createAdminClient } from "@/lib/supabase/admin";

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function icsDateTime(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

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
    lines.push(`DTSTART:${icsDateTime(start)}`);
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
    "PRODID:-//Family Portal//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcs(household.name)}`,
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
