import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToMember } from "./push";

// Same U.S. Eastern DST rule used elsewhere in the app.
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

export function todayEasternDateStr(): string {
  const now = new Date();
  const offset = easternOffsetHours(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
  const eastern = new Date(now.getTime() - offset * 3600000);
  const y = eastern.getUTCFullYear();
  const m = String(eastern.getUTCMonth() + 1).padStart(2, "0");
  const d = String(eastern.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Sends one push per person listing every open chore assigned to them that's due today or
 * overdue. Dedups per household per day via chore_reminders_sent (insert-first-then-send), so
 * it's safe to call this from more than one place: the scheduled Netlify function (if it
 * actually fires -- Netlify's scheduler has proven unreliable) AND as a fallback whenever
 * someone opens the Dashboard, without double-sending on a day both happen to run.
 *
 * Pass householdId to scope the check to one household (the Dashboard fallback); omit it to
 * sweep every household with a chore due today (the scheduled function).
 */
export async function sendDueChoreReminders(admin: SupabaseClient, opts?: { householdId?: string }): Promise<void> {
  const today = todayEasternDateStr();

  let choresQuery = admin
    .from("chores")
    .select("id, title, household_id")
    .eq("status", "open")
    .not("due_date", "is", null)
    .lte("due_date", today);
  if (opts?.householdId) choresQuery = choresQuery.eq("household_id", opts.householdId);

  const { data: chores, error: choresError } = await choresQuery;
  if (choresError) {
    console.error("chore-reminders: failed to fetch chores:", choresError.message);
    return;
  }
  if (!chores?.length) return;

  const householdIds = [...new Set(chores.map((c) => c.household_id))];

  // Claim each household for today -- whichever caller gets here first wins; a second call
  // (scheduled sweep after someone already opened the Dashboard, or vice versa) silently skips
  // any household already claimed.
  const claimed = new Set<string>();
  for (const householdId of householdIds) {
    const { error } = await admin.from("chore_reminders_sent").insert({ household_id: householdId, date: today });
    if (!error) claimed.add(householdId);
  }
  if (!claimed.size) return;

  const relevantChores = chores.filter((c) => claimed.has(c.household_id));
  const choreIds = relevantChores.map((c) => c.id);
  const { data: assignees, error: assigneesError } = await admin
    .from("chore_assignees")
    .select("chore_id, member_id")
    .in("chore_id", choreIds);
  if (assigneesError) {
    console.error("chore-reminders: failed to fetch assignees:", assigneesError.message);
    return;
  }

  const titlesByMember = new Map<string, string[]>();
  for (const chore of relevantChores) {
    const memberIds = (assignees ?? []).filter((a) => a.chore_id === chore.id).map((a) => a.member_id);
    for (const memberId of memberIds) {
      if (!titlesByMember.has(memberId)) titlesByMember.set(memberId, []);
      titlesByMember.get(memberId)!.push(chore.title);
    }
  }

  for (const [memberId, titles] of titlesByMember) {
    const title = titles.length === 1 ? "🧹 Chore due" : `🧹 ${titles.length} chores due`;
    const body = titles.length === 1 ? `${titles[0]} — tap to mark it done` : titles.join(", ");
    await sendPushToMember(admin, memberId, { title, body, url: "/chores" });
  }
}
