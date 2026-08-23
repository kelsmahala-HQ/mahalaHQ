"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdult, requireHousehold } from "@/lib/household";

function revalidateRewards() {
  revalidatePath("/chores");
  revalidatePath("/dashboard");
}

export async function addReward(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireAdult();
  const supabase = await createClient();

  const { error } = await supabase.from("rewards").insert({
    household_id: household.householdId,
    name: formData.get("name") as string,
    cost: Number(formData.get("cost")),
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

  const { data: reward } = await supabase.from("rewards").select("id, name, cost").eq("id", rewardId).single();
  if (!reward) return { error: "That reward no longer exists." };

  const [{ data: completions }, { data: redemptions }] = await Promise.all([
    supabase.from("chore_completions").select("points").eq("member_id", household.memberId),
    supabase.from("reward_redemptions").select("cost").eq("member_id", household.memberId).in("status", ["pending", "approved"]),
  ]);
  const earned = (completions ?? []).reduce((sum, c) => sum + c.points, 0);
  const reserved = (redemptions ?? []).reduce((sum, r) => sum + r.cost, 0);
  const balance = earned - reserved;

  if (balance < reward.cost) return { error: "Not enough points yet." };

  const { error } = await supabase.from("reward_redemptions").insert({
    household_id: household.householdId,
    reward_id: reward.id,
    reward_name: reward.name,
    member_id: household.memberId,
    cost: reward.cost,
  });

  if (error) return { error: error.message };

  revalidateRewards();
  return { success: true };
}

export async function approveRedemption(formData: FormData) {
  const household = await requireAdult();
  const supabase = await createClient();
  await supabase
    .from("reward_redemptions")
    .update({ status: "approved", decided_at: new Date().toISOString(), decided_by: household.userId })
    .eq("id", formData.get("id") as string);
  revalidateRewards();
}

/** Denying just removes the request -- frees up the reserved points, no need to keep a record. */
export async function denyRedemption(formData: FormData) {
  await requireAdult();
  const supabase = await createClient();
  await supabase.from("reward_redemptions").delete().eq("id", formData.get("id") as string);
  revalidateRewards();
}
