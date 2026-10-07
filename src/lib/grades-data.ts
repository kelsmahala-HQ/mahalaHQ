import type { SupabaseClient } from "@supabase/supabase-js";
import { baselineAndLatest } from "./grades";

/** Everything the Grades page, kid dashboard card, and server actions need to know about a plan. */
export async function loadPlanState(supabase: SupabaseClient, planId: string) {
  type CheckinRow = { id: string; taken_on: string; created_at: string; missing_count?: number | null };
  // missing_count came later than the rest of the plan tables; if that column isn't in the
  // database yet, fall back to the original columns instead of showing an empty plan.
  const withMissing = await supabase
    .from("grade_checkins")
    .select("id, taken_on, created_at, missing_count")
    .eq("plan_id", planId)
    .order("taken_on")
    .order("created_at");
  const checkins = withMissing.error
    ? (
        await supabase
          .from("grade_checkins")
          .select("id, taken_on, created_at")
          .eq("plan_id", planId)
          .order("taken_on")
          .order("created_at")
      ).data
    : withMissing.data;
  const checkinRows = (checkins ?? []) as CheckinRow[];
  const order = new Map(checkinRows.map((c, i) => [c.id, i]));

  const { data: entries } = await supabase.from("grade_entries").select("checkin_id, class_name, grade").eq("plan_id", planId);
  const sorted = (entries ?? []).slice().sort((a, z) => (order.get(a.checkin_id) ?? 0) - (order.get(z.checkin_id) ?? 0));

  const { data: awards } = await supabase.from("grade_awards").select("*").eq("plan_id", planId).order("created_at");

  const awardRows = (awards ?? []) as {
    id: string;
    award_key: string;
    class_name: string | null;
    kind: string;
    taken_on: string | null;
    description: string | null;
    paid_at: string | null;
    dollars: number;
    points: number;
    created_at: string;
  }[];

  return {
    checkinCount: checkinRows.length,
    lastCheckinOn: checkinRows.length ? checkinRows[checkinRows.length - 1].taken_on : null,
    /** Missing-assignment totals the parent entered, oldest first (check-ins that skipped the box are left out). */
    missingCounts: checkinRows
      .filter((c) => typeof c.missing_count === "number")
      .map((c) => ({ checkinId: c.id, count: c.missing_count as number })),
    ...baselineAndLatest(sorted),
    awards: awardRows,
    awardedKeys: new Set(awardRows.map((a) => a.award_key)),
    earnedDollars: awardRows.reduce((sum, a) => sum + a.dollars, 0),
    paidDollars: awardRows.filter((a) => a.paid_at).reduce((sum, a) => sum + a.dollars, 0),
  };
}
