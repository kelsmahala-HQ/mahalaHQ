"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAdult, type CurrentHousehold } from "@/lib/household";
import { sendPushToMember } from "@/lib/push";
import { GRADE_RULES, buildProgress, cleanSheetEarned, weeklyStanding } from "@/lib/grades";
import { extractGradesFromFile, type ExtractedGrades } from "@/lib/grades-extract";
import { loadPlanState } from "@/lib/grades-data";

type Plan = { id: string; member_id: string; label: string; cash_cap: number; points_per_dollar: number; status: string };

type AwardDraft = {
  kind: "weekly" | "clean_sheet";
  class_name: string | null;
  award_key: string;
  dollars: number;
  description: string;
  taken_on?: string;
};

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function revalidateGrades() {
  revalidatePath("/grades");
  revalidatePath("/dashboard");
  revalidatePath("/chores");
}

export async function createGradePlan(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireAdult();
  const supabase = await createClient();

  const memberId = formData.get("member_id") as string;
  const label = ((formData.get("label") as string) ?? "").trim();
  const cashCap = Number(formData.get("cash_cap"));
  const pointsPerDollar = Number(formData.get("points_per_dollar"));
  if (!memberId) return { error: "Pick who this plan is for." };
  if (!label) return { error: "Give the plan a name, like Q1 2026-27." };
  if (!Number.isInteger(cashCap) || cashCap < 0) return { error: "The cash cap needs to be a whole number of dollars." };
  if (!Number.isInteger(pointsPerDollar) || pointsPerDollar < 1) return { error: "Points per dollar needs to be 1 or more." };

  const { data: existing } = await supabase
    .from("grade_plans")
    .select("id")
    .eq("household_id", household.householdId)
    .eq("member_id", memberId)
    .eq("status", "active")
    .limit(1);
  if (existing?.length) return { error: "They already have an active plan — close it before starting a new one." };

  const { error } = await supabase.from("grade_plans").insert({
    household_id: household.householdId,
    member_id: memberId,
    label,
    cash_cap: cashCap,
    points_per_dollar: pointsPerDollar,
  });
  if (error) return { error: error.message };

  revalidateGrades();
  return { success: true };
}

/** Reads an uploaded PowerSchool PDF/screenshot into a draft the parent reviews before saving. */
export async function readGradesFile(formData: FormData): Promise<ExtractedGrades | { error: string }> {
  await requireAdult();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF or screenshot first." };
  return extractGradesFromFile(file);
}

async function getActivePlan(supabase: SupabaseClient, household: CurrentHousehold, planId: string): Promise<Plan | null> {
  const { data } = await supabase
    .from("grade_plans")
    .select("id, member_id, label, cash_cap, points_per_dollar, status")
    .eq("id", planId)
    .eq("household_id", household.householdId)
    .single();
  return data && data.status === "active" ? (data as Plan) : null;
}

/**
 * Records new awards once each (grade_awards is unique per plan + award_key) and credits the
 * points to the kid's balance through chore_completions, so the same balance math the rewards
 * store already uses picks them up. Returns what was actually paid.
 */
async function payAwards(
  supabase: SupabaseClient,
  household: CurrentHousehold,
  plan: Plan,
  drafts: AwardDraft[]
): Promise<{ dollars: number; points: number; lines: string[] }> {
  if (!drafts.length) return { dollars: 0, points: 0, lines: [] };

  const { data: inserted, error } = await supabase
    .from("grade_awards")
    .upsert(
      drafts.map((d) => ({
        household_id: household.householdId,
        plan_id: plan.id,
        member_id: plan.member_id,
        class_name: d.class_name,
        kind: d.kind,
        award_key: d.award_key,
        taken_on: d.taken_on ?? null,
        dollars: d.dollars,
        points: d.dollars * plan.points_per_dollar,
      })),
      { onConflict: "plan_id,award_key", ignoreDuplicates: true }
    )
    .select("award_key, dollars, points");
  if (error) throw new Error(error.message);
  if (!inserted?.length) return { dollars: 0, points: 0, lines: [] };

  const { data: member } = await supabase.from("household_members").select("display_name").eq("id", plan.member_id).single();
  const descriptionByKey = new Map(drafts.map((d) => [d.award_key, d.description]));
  const now = new Date().toISOString();

  const { error: creditError } = await supabase.from("chore_completions").insert(
    inserted.map((a) => ({
      household_id: household.householdId,
      chore_id: null,
      member_id: plan.member_id,
      points: a.points,
      kind: "grade",
      approval_status: "approved",
      chore_title: `📚 ${descriptionByKey.get(a.award_key) ?? "Grades"}`,
      member_name: member?.display_name ?? null,
      decided_at: now,
      decided_by: household.userId,
    }))
  );
  if (creditError) throw new Error(creditError.message);

  const dollars = inserted.reduce((s, a) => s + a.dollars, 0);
  const points = inserted.reduce((s, a) => s + a.points, 0);
  const lines = inserted.map((a) => descriptionByKey.get(a.award_key) ?? "Grades");

  await sendPushToMember(supabase, plan.member_id, {
    title: `📚 +${points} points for your grades!`,
    body: lines.slice(0, 3).join(" · ") + (lines.length > 3 ? ` · +${lines.length - 3} more` : ""),
    url: "/dashboard",
  });

  return { dollars, points, lines };
}

/** Saves a reviewed check-in and pays whatever it newly earns. The first check-in is the baseline. */
export async function saveGradeCheckin(
  formData: FormData
): Promise<{ error: string } | { success: true; message: string }> {
  const household = await requireAdult();
  const supabase = await createClient();

  const plan = await getActivePlan(supabase, household, formData.get("plan_id") as string);
  if (!plan) return { error: "That plan isn't active anymore." };

  const names = formData.getAll("class_name") as string[];
  const grades = formData.getAll("grade") as string[];
  const rows = names
    .map((n, i) => ({ class_name: n.trim(), grade: (grades[i] ?? "").trim() }))
    .filter((r) => r.class_name && r.grade);
  if (!rows.length) return { error: "Add at least one class with a grade." };

  const takenOn = (formData.get("taken_on") as string) || new Date().toISOString().slice(0, 10);

  const { data: checkin, error: checkinError } = await supabase
    .from("grade_checkins")
    .insert({ household_id: household.householdId, plan_id: plan.id, taken_on: takenOn })
    .select("id")
    .single();
  if (checkinError) return { error: checkinError.message };

  const { error: entriesError } = await supabase.from("grade_entries").insert(
    rows.map((r) => ({
      household_id: household.householdId,
      checkin_id: checkin.id,
      plan_id: plan.id,
      class_name: r.class_name,
      grade: r.grade,
    }))
  );
  if (entriesError) return { error: entriesError.message };

  const state = await loadPlanState(supabase, plan.id);
  const isBaseline = state.checkinCount === 1;

  // Weekly pay is for where each class stands today vs where it started the quarter. The first
  // upload is only the starting point. A second upload inside the same 7 days (a fix, or an
  // extra look) only tops up to this week's standing -- it can't pay the same week twice.
  const drafts: AwardDraft[] = [];
  if (!isBaseline) {
    const standing = weeklyStanding(buildProgress(state.baseline, state.latest));
    const windowStart = shiftDate(takenOn, -6);
    const paidThisWeek = state.awards
      .filter((a) => a.kind === "weekly" && a.taken_on && a.taken_on >= windowStart && a.taken_on <= takenOn)
      .reduce((sum, a) => sum + a.dollars, 0);
    const dollars = Math.min(Math.max(0, standing.dollars - paidThisWeek), plan.cash_cap - state.earnedDollars);
    if (dollars > 0) {
      drafts.push({
        kind: "weekly",
        class_name: null,
        award_key: `week:${checkin.id}`,
        dollars,
        description: standing.description,
        taken_on: takenOn,
      });
    }
  }

  let paid;
  try {
    paid = await payAwards(supabase, household, plan, drafts);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't record the awards." };
  }

  revalidateGrades();
  return {
    success: true,
    message: isBaseline
      ? "Saved as the starting point — nothing is paid yet. Upload again next week to start earning."
      : paid.lines.length
        ? `Paid ⭐ ${paid.points} ($${paid.dollars}) — ${paid.lines.join("; ")}`
        : "Saved — nothing to pay this week (no class is above where it started, or this week was already paid).",
  };
}

/** Quarter-end: pays the "every class at a C or better" bonus, then closes the plan. */
export async function closeGradePlan(formData: FormData): Promise<{ error: string } | { success: true; message: string }> {
  const household = await requireAdult();
  const supabase = await createClient();

  const plan = await getActivePlan(supabase, household, formData.get("plan_id") as string);
  if (!plan) return { error: "That plan isn't active anymore." };

  const state = await loadPlanState(supabase, plan.id);
  const drafts: AwardDraft[] = [];
  const remaining = plan.cash_cap - state.earnedDollars;
  if (cleanSheetEarned(state.latest) && !state.awardedKeys.has("clean_sheet") && remaining > 0) {
    drafts.push({
      kind: "clean_sheet",
      class_name: null,
      award_key: "clean_sheet",
      dollars: Math.min(GRADE_RULES.cleanSheet, remaining),
      description: "Every class at a C or better",
    });
  }

  let paid;
  try {
    paid = await payAwards(supabase, household, plan, drafts);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't record the awards." };
  }

  const { error } = await supabase
    .from("grade_plans")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", plan.id);
  if (error) return { error: error.message };

  revalidateGrades();
  return {
    success: true,
    message: paid.lines.length ? `Closed. Paid ⭐ ${paid.points} ($${paid.dollars}): ${paid.lines.join("; ")}` : "Closed — no quarter-end bonuses earned.",
  };
}

/** Changes the most a plan can ever pay out -- e.g. when the quarterly budget changes. */
export async function updateGradePlanCap(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireAdult();
  const supabase = await createClient();

  const cashCap = Number(formData.get("cash_cap"));
  if (!Number.isInteger(cashCap) || cashCap < 0) return { error: "The cap needs to be a whole number of dollars." };

  const { error } = await supabase
    .from("grade_plans")
    .update({ cash_cap: cashCap })
    .eq("id", formData.get("plan_id") as string)
    .eq("household_id", household.householdId);
  if (error) return { error: error.message };

  revalidateGrades();
  return { success: true };
}
