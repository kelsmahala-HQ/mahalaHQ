import { addDays, addMonths, addWeeks, addYears } from "date-fns";

export type ExternalEvent = {
  uid: string;
  title: string;
  startAt: Date;
  allDay: boolean;
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | null;
  interval: number;
  until: Date | null;
  count: number | null;
};

function unescapeIcsText(text: string): string {
  return text.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

/** Unfolds RFC5545 line-folding (continuation lines start with a space or tab). */
function unfold(icsText: string): string[] {
  const rawLines = icsText.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** Parses a DTSTART/DTEND-style value (with its property params) into a Date + whether it's all-day. */
function parseIcsDate(propLine: string): { date: Date; allDay: boolean } | null {
  const colonIdx = propLine.indexOf(":");
  if (colonIdx === -1) return null;
  const params = propLine.slice(0, colonIdx);
  const value = propLine.slice(colonIdx + 1).trim();
  const allDay = params.includes("VALUE=DATE") && !params.includes("VALUE=DATE-TIME");

  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  if (!h || allDay) {
    return { date: new Date(Number(y), Number(mo) - 1, Number(d)), allDay: true };
  }
  // Ignores timezone conversion (TZID / trailing "Z") and treats the wall-clock time as local —
  // acceptable for a family calendar overlay, not a general-purpose ICS client.
  return { date: new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)), allDay: false };
}

function parseRrule(value: string): { freq: ExternalEvent["freq"]; interval: number; until: Date | null; count: number | null } {
  const parts = Object.fromEntries(value.split(";").map((p) => p.split("=") as [string, string]));
  const freq = (["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const).includes(parts.FREQ as never)
    ? (parts.FREQ as ExternalEvent["freq"])
    : null;
  const until = parts.UNTIL ? parseIcsDate(`:${parts.UNTIL}`)?.date ?? null : null;
  const count = parts.COUNT ? Number(parts.COUNT) : null;
  return { freq, interval: Number(parts.INTERVAL) || 1, until, count };
}

/** Minimal ICS parser: extracts SUMMARY/DTSTART/RRULE from each VEVENT. Not a general-purpose ICS client. */
export function parseIcsEvents(icsText: string): ExternalEvent[] {
  const lines = unfold(icsText);
  const events: ExternalEvent[] = [];
  let inEvent = false;
  let current: Partial<ExternalEvent> & { title?: string; startInfo?: { date: Date; allDay: boolean } } = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (inEvent && current.startInfo && current.title) {
        events.push({
          uid: current.uid ?? `${current.title}-${current.startInfo.date.toISOString()}`,
          title: current.title,
          startAt: current.startInfo.date,
          allDay: current.startInfo.allDay,
          freq: current.freq ?? null,
          interval: current.interval ?? 1,
          until: current.until ?? null,
          count: current.count ?? null,
        });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    if (line.startsWith("SUMMARY")) {
      current.title = unescapeIcsText(line.slice(line.indexOf(":") + 1));
    } else if (line.startsWith("DTSTART")) {
      const parsed = parseIcsDate(line);
      if (parsed) current.startInfo = parsed;
    } else if (line.startsWith("UID")) {
      current.uid = line.slice(line.indexOf(":") + 1);
    } else if (line.startsWith("RRULE")) {
      const { freq, interval, until, count } = parseRrule(line.slice(line.indexOf(":") + 1));
      current.freq = freq;
      current.interval = interval;
      current.until = until;
      current.count = count;
    }
  }

  return events;
}

function advanceExternal(date: Date, freq: NonNullable<ExternalEvent["freq"]>, interval: number): Date {
  switch (freq) {
    case "DAILY":
      return addDays(date, interval);
    case "WEEKLY":
      return addWeeks(date, interval);
    case "MONTHLY":
      return addMonths(date, interval);
    case "YEARLY":
      return addYears(date, interval);
  }
}

export type ExternalOccurrence = { key: string; title: string; startAt: Date; allDay: boolean };

/** Expands (possibly recurring) external events into occurrences within [rangeStart, rangeEndExclusive). */
export function expandExternalOccurrences(
  events: ExternalEvent[],
  rangeStart: Date,
  rangeEndExclusive: Date
): ExternalOccurrence[] {
  const result: ExternalOccurrence[] = [];

  for (const e of events) {
    if (!e.freq) {
      if (e.startAt >= rangeStart && e.startAt < rangeEndExclusive) {
        result.push({ key: e.uid, title: e.title, startAt: e.startAt, allDay: e.allDay });
      }
      continue;
    }

    let occurrence = e.startAt;
    let guard = 0;
    let n = 0;
    while (occurrence < rangeEndExclusive && guard < 500) {
      if (e.until && occurrence > e.until) break;
      if (e.count && n >= e.count) break;
      if (occurrence >= rangeStart) {
        result.push({ key: `${e.uid}-${occurrence.toISOString()}`, title: e.title, startAt: occurrence, allDay: e.allDay });
      }
      occurrence = advanceExternal(occurrence, e.freq, e.interval);
      n++;
      guard++;
    }
  }

  return result;
}

/** Fetches and parses an external ICS calendar URL, returning occurrences in range. Never throws. */
export async function fetchExternalEvents(
  url: string,
  rangeStart: Date,
  rangeEndExclusive: Date
): Promise<{ occurrences: ExternalOccurrence[]; error: string | null }> {
  try {
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return { occurrences: [], error: `Google Calendar returned an error (${res.status}).` };
    const text = await res.text();
    const events = parseIcsEvents(text);
    return { occurrences: expandExternalOccurrences(events, rangeStart, rangeEndExclusive), error: null };
  } catch {
    return { occurrences: [], error: "Couldn't reach Google Calendar right now." };
  }
}
