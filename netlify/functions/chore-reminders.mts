import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { sendPushToMember } from "../../src/lib/push";

// Same U.S. Eastern DST rule used by the other scheduled functions.
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

function todayEasternDateStr(): string {
  const now = new Date();
  const offset = easternOffsetHours(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
  const eastern = new Date(now.getTime() - offset * 3600000);
  const y = eastern.getUTCFullYear();
  const m = String(eastern.getUTCMonth() + 1).padStart(2, "0");
  const d = String(eastern.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Sends one push per person, once a day, listing every open chore that's due today or
 *  overdue -- so a recurring chore (e.g. "clean the living room every evening") keeps
 *  reminding whoever it's assigned to until they actually mark it done, not just once at
 *  assignment time. */
async function choreReminders() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  const today = todayEasternDateStr();

  const { data: chores } = await admin
    .from("chores")
    .select("id, title")
    .eq("status", "open")
    .not("due_date", "is", null)
    .lte("due_date", today);

  if (!chores?.length) return;

  const choreIds = chores.map((c) => c.id);
  const { data: assignees } = await admin.from("chore_assignees").select("chore_id, member_id").in("chore_id", choreIds);

  const titlesByMember = new Map<string, string[]>();
  for (const chore of chores) {
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

export default choreReminders;

// Once daily, ~8-9am Eastern depending on DST.
export const config: Config = {
  schedule: "0 13 * * *",
};
