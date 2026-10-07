"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAdult, requireHousehold } from "@/lib/household";
import { sendPushToManagers, sendPushToMember } from "@/lib/push";
import { balanceFor, type PointSource } from "@/lib/points";

function revalidateRewards() {
  revalidatePath("/chores");
  revalidatePath("/dashboard");
}

/** Adults manage rewards on /chores; kids see theirs on /dashboard. */
async function landingForMember(supabase: SupabaseClient, memberId: string): Promise<string> {
  const { data } = await supabase.from("household_members").select("role").eq("id", memberId).single();
  return data?.role === "admin" || data?.role === "adult" ? "/chores" : "/dashboard";
}

export async function addReward(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireAdult();
  const supabase = await createClient();

  const audience = (formData.get("audience") as string) === "adult" ? "adult" : "kid";

  const source: PointSource = (formData.get("source") as string) === "grades" ? "grades" : "chores";
  const cashValue = Number(formData.get("cash_value"));

  const { error } = await supabase.from("rewards").insert({
    household_id: household.householdId,
    name: formData.get("name") as string,
    cost: Number(formData.get("cost")),
    audience,
    source,
    cash_value: Number.isInteger(cashValue) && cashValue > 0 ? cashValue : null,
  });

  if (error) return { error: error.message };

  revalidateRewards();
  return { success: true };
}

export async function deleteReward(formData: FormData) {
  await requireAdult();
  const supabase = await createClient();
  await supabase.from("rewards").delete().eq("id", formData.get("id") as string);
  revalidateRewards();
}

/** Kids request for themselves only -- member_id always comes from the signed-in session, never the client. */
export async function requestRedemption(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();
  const rewardId = formData.get("reward_id") as string;

  const { data: reward } = await supabase.from("rewards").select("id, name, cost, cash_value, source").eq("id", rewardId).single();
  if (!reward) return { error: "That reward no longer exists." };

  const source: PointSource = reward.source === "grades" ? "grades" : "chores";
  const [{ data: completions }, { data: redemptions }] = await Promise.all([
    supabase.from("chore_completions").select("points, approval_status, kind").eq("member_id", household.memberId),
    supabase.from("reward_redemptions").select("cost, status, source").eq("member_id", household.memberId),
  ]);
  const balance = balanceFor(source, completions ?? [], redemptions ?? []);

  if (balance < reward.cost) return { error: "Not enough points yet." };

  const { error } = await supabase.from("reward_redemptions").insert({
    household_id: household.householdId,
    reward_id: reward.id,
    reward_name: reward.name,
    member_id: household.memberId,
    cost: reward.cost,
    source,
    cash_value: reward.cash_value,
  });

  if (error) return { error: error.message };

  await sendPushToManagers(
    supabase,
    household.householdId,
    {
      title: "🎁 Reward request",
      body: `${household.displayName} wants ${reward.name} (⭐ ${reward.cost})`,
      url: "/chores",
    },
    { exceptMemberId: household.memberId }
  );

  revalidateRewards();
  return { success: true };
}

export async function approveRedemption(formData: FormData) {
  const household = await requireAdult();
  const supabase = await createClient();
  const id = formData.get("id") as string;

  const { data: redemption } = await supabase
    .from("reward_redemptions")
    .select("member_id, reward_name")
    .eq("id", id)
    .single();

  await supabase
    .from("reward_redemptions")
    .update({ status: "approved", decided_at: new Date().toISOString(), decided_by: household.userId })
    .eq("id", id);

  if (redemption && redemption.member_id !== household.memberId) {
    await sendPushToMember(supabase, redemption.member_id, {
      title: "🎉 Reward approved!",
      body: `${redemption.reward_name} — all yours.`,
      url: await landingForMember(supabase, redemption.member_id),
    });
  }

  revalidateRewards();
}

/** Stamps a cash reward as handed over -- it drops off the "still owed" list. */
export async function markRedemptionPaid(formData: FormData) {
  const household = await requireAdult();
  const supabase = await createClient();
  await supabase
    .from("reward_redemptions")
    .update({ paid_at: new Date().toISOString() })
    .eq("id", formData.get("id") as string)
    .eq("household_id", household.householdId)
    .eq("status", "approved")
    .is("paid_at", null);
  revalidatePath("/chores");
  revalidatePath("/grades");
}

/** Denying just removes the request -- frees up the reserved points, no need to keep a record. */
export async function denyRedemption(formData: FormData) {
  const household = await requireAdult();
  const supabase = await createClient();
  const id = formData.get("id") as string;

  const { data: redemption } = await supabase
    .from("reward_redemptions")
    .select("member_id, reward_name")
    .eq("id", id)
    .single();

  await supabase.from("reward_redemptions").delete().eq("id", id);

  if (redemption && redemption.member_id !== household.memberId) {
    await sendPushToMember(supabase, redemption.member_id, {
      title: "Reward request declined",
      body: `${redemption.reward_name} wasn't approved this time — your points are back.`,
      url: await landingForMember(supabase, redemption.member_id),
    });
  }

  revalidateRewards();
}
