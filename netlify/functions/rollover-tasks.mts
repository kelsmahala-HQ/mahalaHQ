import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// Same U.S. Eastern DST rule used by the ICS feed and calendar-reminders function.
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

/** Rolls any not-done To-Do/Follow-up items forward onto today, no matter how many days
 *  they've been sitting unfinished -- so opening today's Day Planner always shows the
 *  current backlog instead of leaving stale items buried on a past date. */
async function rolloverTasks() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  const today = todayEasternDateStr();

  const { data, error } = await admin
    .from("day_planner_tasks")
    .update({ date: today })
    .eq("is_done", false)
    .lt("date", today)
    .select("id");

  if (error) {
    console.error("rollover-tasks: update failed:", error.message);
    return;
  }
  console.log(`rollover-tasks: rolled ${data?.length ?? 0} task(s) forward to ${today}`);
}

export default rolloverTasks;

// 09:00 UTC = 4-5am Eastern depending on DST -- safely after midnight Eastern either way.
export const config: Config = {
  schedule: "0 9 * * *",
};
