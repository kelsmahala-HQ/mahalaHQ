import type { SupabaseClient } from "@supabase/supabase-js";
import { baselineAndLatest } from "./grades";

/** Everything the Grades page, kid dashboard card, and server actions need to know about a plan. */
export async function loadPlanState(supabase: SupabaseClient, planId: string) {
  const { data: checkins } = await supabase
    .from("grade_checkins")
    .select("id, taken_on, created_at")
    .eq("plan_id", planId)
    .order("taken_on")
    .order("created_at");
  const order = new Map((checkins ?? []).map((c, i) => [c.id as string, i]));

  const { data: entries } = await supabase.from("grade_entries").select("checkin_id, class_name, grade").eq("plan_id", planId);
  const sorted = (entries ?? []).slice().sort((a, z) => (order.get(a.checkin_id) ?? 0) - (order.get(z.checkin_id) ?? 0));

  const { data: awards } = await supabase.from("grade_awards").select("*").eq("plan_id", planId).order("created_at");

  const awardRows = (awards ?? []) as {
    id: string;
    award_key: string;
    class_name: string | null;
    kind: string;
    dollars: number;
    points: number;
    created_at: string;
  }[];

  return {
    checkinCount: checkins?.length ?? 0,
    lastCheckinOn: checkins?.length ? (checkins[checkins.length - 1].taken_on as string) : null,
    ...baselineAndLatest(sorted),
    awards: awardRows,
    awardedKeys: new Set(awardRows.map((a) => a.award_key)),
    earnedDollars: awardRows.reduce((sum, a) => sum + a.dollars, 0),
    earnedPoints: awardRows.reduce((sum, a) => sum + a.points, 0),
  };
}
