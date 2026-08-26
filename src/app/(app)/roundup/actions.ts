"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { applyDebtPayment } from "@/lib/debt-payment";
import { calculateRoundUp } from "@/lib/roundup";
import { notifyIfThresholdReached } from "@/lib/roundup-notify";

export async function updateSettings(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();

  await supabase.from("roundup_settings").upsert({
    household_id: household.householdId,
    multiplier: Number(formData.get("multiplier")) || 2,
    threshold: Number(formData.get("threshold")) || 25,
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/roundup");
}

export async function addPurchase(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();
  const amount = Number(formData.get("amount"));

  const { data: settings } = await supabase
    .from("roundup_settings")
    .select("multiplier")
    .eq("household_id", household.householdId)
    .maybeSingle();

  const multiplier = Number(settings?.multiplier ?? 2);
  const roundUp = calculateRoundUp(amount, multiplier);

  await supabase.from("roundup_purchases").insert({
    household_id: household.householdId,
    amount,
    round_up: roundUp,
  });

  await notifyIfThresholdReached(household.householdId, household.householdName);

  revalidatePath("/roundup");
}

export async function sendPayout(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();
  const debtId = formData.get("debt_id") as string;
  const requestedAmount = Number(formData.get("amount"));

  // Guards against a double-click/double-tap firing this twice before the page re-renders and
  // hides the button -- without this, two near-simultaneous submissions can each read the same
  // "available" balance and both insert a full payout, draining more than was actually saved.
  const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
  const { data: recentPayout } = await supabase
    .from("roundup_payouts")
    .select("id")
    .eq("household_id", household.householdId)
    .eq("debt_id", debtId)
    .gte("created_at", tenSecondsAgo)
    .maybeSingle();
  if (recentPayout) return { error: "Already sent — give it a moment to update." };

  const [{ data: purchases }, { data: payouts }] = await Promise.all([
    supabase.from("roundup_purchases").select("round_up").eq("household_id", household.householdId),
    supabase.from("roundup_payouts").select("amount").eq("household_id", household.householdId),
  ]);

  const totalSaved = (purchases ?? []).reduce((sum, p) => sum + Number(p.round_up), 0);
  const totalPaidOut = (payouts ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const available = totalSaved - totalPaidOut;
  const amount = Math.min(requestedAmount, available);

  if (amount <= 0) return { error: "Nothing available to send." };

  const { error: insertError } = await supabase.from("roundup_payouts").insert({
    household_id: household.householdId,
    debt_id: debtId,
    amount,
  });
  if (insertError) return { error: insertError.message };

  await applyDebtPayment(supabase, debtId, amount, { note: "Round-up payment" });
  await supabase.from("roundup_settings").upsert({ household_id: household.householdId, notified: false });

  revalidatePath("/roundup");
  revalidatePath("/debts");
  return { success: true };
}
