"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAdult, type CurrentHousehold } from "@/lib/household";
import { sendPushToManagers, sendPushToMember } from "@/lib/push";
import { GRADE_RULES, buildProgress, cleanSheetEarned, formatMoney, groundedStatus, round2, weeklyStanding } from "@/lib/grades";
import { extractGradesFromFile, type ExtractedGrades } from "@/lib/grades-extract";
import { loadPlanState } from "@/lib/grades-data";

type Plan = { id: string; member_id: string; label: string; cash_cap: number; weekly_cap?: number | null; status: string };

type AwardDraft = {
  kind: "weekly" | "clean_sheet";
  class_name: string | null;
  award_key: string;
  dollars: number;
  description: string;
  taken_on?: string;
  held?: boolean;
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
  const weeklyCap = Number(formData.get("weekly_cap") || GRADE_RULES.weeklyCap);
  if (!memberId) return { error: "Pick who this plan is for." };
  if (!label) return { error: "Give the plan a name, like Q1 2026-27." };
  if (!Number.isInteger(cashCap) || cashCap < 0) return { error: "The cash cap needs to be a whole number of dollars." };
  if (!Number.isInteger(weeklyCap) || weeklyCap < 0) return { error: "The weekly cap needs to be a whole number of dollars." };

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
    weekly_cap: weeklyCap,
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
    .select("*")
    .eq("id", planId)
    .eq("household_id", household.householdId)
    .single();
  return data && data.status === "active" ? (data as Plan) : null;
}

/**
 * Records new awards once each (grade_awards is unique per plan + award_key). Grades pay in plain
 * dollars you owe -- no points, no store. An award stays "owed" (paid_at null) until you mark it
 * paid. Returns what was actually added.
 */
async function payAwards(
  supabase: SupabaseClient,
  household: CurrentHousehold,
  plan: Plan,
  drafts: AwardDraft[]
): Promise<{ dollars: number; lines: string[]; name: string }> {
  const { data: member } = await supabase.from("household_members").select("display_name").eq("id", plan.member_id).single();
  const name = member?.display_name ?? "them";
  if (!drafts.length) return { dollars: 0, lines: [], name };

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
        description: d.description,
        dollars: d.dollars,
        points: 0,
        ...(d.held ? { held: true } : {}),
      })),
      { onConflict: "plan_id,award_key", ignoreDuplicates: true }
    )
    .select("award_key, dollars");
  if (error) throw new Error(error.message);
  if (!inserted?.length) return { dollars: 0, lines: [], name };

  const descriptionByKey = new Map(drafts.map((d) => [d.award_key, d.description]));
  const dollars = inserted.reduce((s, a) => s + a.dollars, 0);
  const lines = inserted.map((a) => descriptionByKey.get(a.award_key) ?? "Grades");

  // Held pay isn't hers yet, so don't tell her she earned it -- the stay-in notice covers that.
  if (!drafts.some((d) => d.held)) {
    await sendPushToMember(supabase, plan.member_id, {
      title: `📚 You earned ${formatMoney(dollars)} for your grades!`,
      body: lines.slice(0, 3).join(" · ") + (lines.length > 3 ? ` · +${lines.length - 3} more` : ""),
      url: "/dashboard",
    });
  }

  return { dollars, lines, name };
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

  // Remember whether the stay-in rule applied before this report, so we can tell if it just changed.
  const before = await loadPlanState(supabase, plan.id);
  const wasGrounded = groundedStatus(buildProgress(before.baseline, before.latest)).grounded;

  // Optional: how many assignments are missing right now. Pay comes from the drop since the last
  // time a number was entered, so there's nothing to subtract by hand.
  const missingRaw = (formData.get("missing_count") as string | null)?.trim() ?? "";
  const missingCount = missingRaw === "" ? null : Number(missingRaw);
  if (missingCount !== null && (!Number.isInteger(missingCount) || missingCount < 0)) {
    return { error: "Missing assignments needs to be a whole number, or leave it blank." };
  }

  const { data: checkin, error: checkinError } = await supabase
    .from("grade_checkins")
    .insert({
      household_id: household.householdId,
      plan_id: plan.id,
      taken_on: takenOn,
      ...(missingCount !== null ? { missing_count: missingCount } : {}),
    })
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
  // Every upload pays that week's standing: each class by its current grade, plus any missing
  // assignments turned in. A second upload inside the same 7 days only tops up to this week's
  // standing -- it can't pay the same week twice.
  const groundedNow = groundedStatus(buildProgress(state.baseline, state.latest)).grounded;
  const drafts: AwardDraft[] = [];
  {
    // Compare against the most recent earlier check-in that had a number (this one is last).
    const counts = state.missingCounts.filter((c) => c.checkinId !== checkin.id);
    const previousMissing = counts.length ? counts[counts.length - 1].count : null;
    const turnedIn = missingCount !== null && previousMissing !== null ? Math.max(0, previousMissing - missingCount) : 0;
    const standing = weeklyStanding(
      buildProgress(state.baseline, state.latest),
      turnedIn,
      plan.weekly_cap ?? GRADE_RULES.weeklyCap
    );
    const windowStart = shiftDate(takenOn, -6);
    const paidThisWeek = state.awards
      .filter((a) => a.kind === "weekly" && a.taken_on && a.taken_on >= windowStart && a.taken_on <= takenOn)
      .reduce((sum, a) => sum + a.dollars, 0);
    const dollars = round2(Math.min(Math.max(0, standing.dollars - paidThisWeek), plan.cash_cap - state.earnedDollars));
    if (dollars > 0) {
      drafts.push({
        kind: "weekly",
        class_name: null,
        award_key: `week:${checkin.id}`,
        dollars,
        description: standing.description,
        taken_on: takenOn,
        // Over the stay-in limit: the pay is earned but held until she's back under it.
        held: groundedNow,
      });
    }
  }

  let paid;
  try {
    paid = await payAwards(supabase, household, plan, drafts);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't record the awards." };
  }

  // Back under the limit: everything that was being held becomes owed. (If the held columns
  // aren't in the database yet, there's nothing held to release.)
  let releasedDollars = 0;
  if (!groundedNow) {
    const { data: held, error: heldError } = await supabase
      .from("grade_awards")
      .select("id, dollars")
      .eq("plan_id", plan.id)
      .eq("held", true)
      .eq("forfeited", false);
    if (!heldError && held?.length) {
      const { error: releaseError } = await supabase
        .from("grade_awards")
        .update({ held: false })
        .in("id", held.map((h) => h.id));
      if (!releaseError) releasedDollars = round2(held.reduce((sum, h) => sum + Number(h.dollars), 0));
    }
  }

  const after = groundedStatus(buildProgress(state.baseline, state.latest));
  let groundedNote = "";
  if (after.grounded !== wasGrounded) {
    const { data: kid } = await supabase.from("household_members").select("display_name").eq("id", plan.member_id).single();
    const kidName = kid?.display_name ?? "She";
    if (after.grounded) {
      groundedNote = ` ⚠️ ${kidName} now has ${after.count} classes below a C- (limit ${after.limit}), so she's staying in until it's back down.`;
      await sendPushToMember(supabase, plan.member_id, {
        title: "📚 You're staying in for now",
        body: `${after.count} classes are below a C-. Get it down to ${after.limit} or fewer to be free to go.`,
        url: "/dashboard",
      });
    } else {
      groundedNote = ` ✅ ${kidName} is back to ${after.count} classes below a C- — free to go.`;
      await sendPushToMember(supabase, plan.member_id, {
        title: "📚 You're free to go!",
        body: `You're back to ${after.count} classes below a C- or fewer. Nice work.`,
        url: "/dashboard",
      });
    }
    await sendPushToManagers(
      supabase,
      household.householdId,
      { title: after.grounded ? "📚 Over the grade limit" : "📚 Back under the grade limit", body: groundedNote.trim(), url: "/grades" },
      { exceptMemberId: household.memberId }
    );
  }

  if (releasedDollars > 0) {
    groundedNote += ` 💰 ${formatMoney(releasedDollars)} that was being held is now owed.`;
    await sendPushToMember(supabase, plan.member_id, {
      title: `💰 ${formatMoney(releasedDollars)} released`,
      body: "You're back under the limit, so the pay that was on hold is yours.",
      url: "/dashboard",
    });
  }

  revalidateGrades();
  return {
    success: true,
    message: paid.lines.length && groundedNow
      ? `Held ${formatMoney(paid.dollars)} for ${paid.name} — she's over the limit, so it's released once she's back to ${after.limit} or fewer classes below a C-.${groundedNote}`
      : paid.lines.length
      ? `You owe ${paid.name} ${formatMoney(paid.dollars)} for this week — ${paid.lines.join("; ")}${groundedNote}`
      : `Saved — nothing new to pay (this week was already paid, or the cap is reached).${groundedNote}`,
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

  // Pay still being held when the quarter ends is gone.
  let forfeitedDollars = 0;
  const { data: stillHeld, error: stillHeldError } = await supabase
    .from("grade_awards")
    .select("id, dollars")
    .eq("plan_id", plan.id)
    .eq("held", true)
    .eq("forfeited", false);
  if (!stillHeldError && stillHeld?.length) {
    const { error: forfeitError } = await supabase
      .from("grade_awards")
      .update({ forfeited: true })
      .in("id", stillHeld.map((h) => h.id));
    if (!forfeitError) forfeitedDollars = round2(stillHeld.reduce((sum, h) => sum + Number(h.dollars), 0));
  }

  const { error } = await supabase
    .from("grade_plans")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", plan.id);
  if (error) return { error: error.message };

  revalidateGrades();
  return {
    success: true,
    message:
      (paid.lines.length
        ? `Closed. You owe ${paid.name} another ${formatMoney(paid.dollars)} — ${paid.lines.join("; ")}`
        : "Closed — no quarter-end bonuses earned.") +
      (forfeitedDollars > 0 ? ` ${formatMoney(forfeitedDollars)} that was still on hold is forfeited.` : ""),
  };
}

/** Changes the most a plan can ever pay out -- e.g. when the quarterly budget changes. */
export async function updateGradePlanCap(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireAdult();
  const supabase = await createClient();

  const cashCap = Number(formData.get("cash_cap"));
  const weeklyRaw = formData.get("weekly_cap");
  const weeklyCap = weeklyRaw === null || weeklyRaw === "" ? null : Number(weeklyRaw);
  if (!Number.isInteger(cashCap) || cashCap < 0) return { error: "The quarterly cap needs to be a whole number of dollars." };
  if (weeklyCap !== null && (!Number.isInteger(weeklyCap) || weeklyCap < 0)) {
    return { error: "The weekly cap needs to be a whole number of dollars." };
  }

  const { error } = await supabase
    .from("grade_plans")
    .update({ cash_cap: cashCap, ...(weeklyCap !== null ? { weekly_cap: weeklyCap } : {}) })
    .eq("id", formData.get("plan_id") as string)
    .eq("household_id", household.householdId);
  if (error) return { error: error.message };

  revalidateGrades();
  return { success: true };
}

/** Marks one owed grade payout as handed over, so it leaves the Cash to pay out list. Held pay can't be paid. */
export async function markGradeAwardPaid(formData: FormData) {
  const household = await requireAdult();
  const supabase = await createClient();
  const id = formData.get("id") as string;

  const { data: award } = await supabase.from("grade_awards").select("*").eq("id", id).eq("household_id", household.householdId).single();
  if (!award || award.held || award.forfeited || award.paid_at) return;

  await supabase.from("grade_awards").update({ paid_at: new Date().toISOString() }).eq("id", id);
  revalidateGrades();
}

/** Marks everything currently owed (not held) to one kid for grades as paid in one go. */
export async function markAllGradeAwardsPaid(formData: FormData) {
  const household = await requireAdult();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("grade_awards")
    .select("*")
    .eq("member_id", formData.get("member_id") as string)
    .eq("household_id", household.householdId)
    .is("paid_at", null);
  const ids = (rows ?? []).filter((r) => !r.held && !r.forfeited).map((r) => r.id);
  if (!ids.length) return;

  await supabase.from("grade_awards").update({ paid_at: new Date().toISOString() }).in("id", ids);
  revalidateGrades();
}

/**
 * Sets the current missing-assignments total on the most recent check-in without paying anything
 * -- for adding the starting number to a check-in saved before the box existed, or correcting a
 * typo. Next upload's drop is measured against this number.
 */
export async function setLatestMissingCount(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireAdult();
  const supabase = await createClient();

  const missingCount = Number(formData.get("missing_count"));
  if (!Number.isInteger(missingCount) || missingCount < 0) return { error: "Enter a whole number, like 3." };

  const plan = await getActivePlan(supabase, household, formData.get("plan_id") as string);
  if (!plan) return { error: "That plan isn't active anymore." };

  const { data: latest } = await supabase
    .from("grade_checkins")
    .select("id")
    .eq("plan_id", plan.id)
    .order("taken_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return { error: "Upload a check-in first." };

  const { error } = await supabase.from("grade_checkins").update({ missing_count: missingCount }).eq("id", latest.id);
  if (error) return { error: error.message };

  revalidateGrades();
  return { success: true };
}
