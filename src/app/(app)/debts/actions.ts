"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { applyDebtPayment } from "@/lib/debt-payment";
import { syncDebtBill } from "@/lib/debt-bill-sync";

function revalidateBudgetPaths() {
  revalidatePath("/debts");
  revalidatePath("/budget");
  revalidatePath("/budget/month");
  revalidatePath("/budget/manage");
}

export async function addDebt(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();
  const balance = Number(formData.get("current_balance"));

  const paymentFrequency = (formData.get("payment_frequency") as string) || "monthly";
  const minimumPayment = formData.get("minimum_payment") ? Number(formData.get("minimum_payment")) : null;
  const dueDay = paymentFrequency === "monthly" && formData.get("due_day") ? Number(formData.get("due_day")) : null;
  const dueWeekday = paymentFrequency === "weekly" && formData.get("due_weekday") ? Number(formData.get("due_weekday")) : null;

  const { data: debt, error } = await supabase
    .from("debts")
    .insert({
      household_id: household.householdId,
      name: formData.get("name") as string,
      creditor: formData.get("creditor") as string,
      original_balance: balance,
      current_balance: balance,
      interest_rate: formData.get("interest_rate") ? Number(formData.get("interest_rate")) : null,
      minimum_payment: minimumPayment,
      payment_frequency: paymentFrequency,
      due_day: dueDay,
      due_weekday: dueWeekday,
    })
    .select("id, name, minimum_payment, payment_frequency, due_day, due_weekday")
    .single();

  if (error) return { error: error.message };

  // Mirror the minimum payment into Budget as a bill, so it shows up in the weekly checklist
  // without having to re-enter it in Manage Bills. Silently skips (not an error) if the debt
  // doesn't have both a minimum payment and a due day/weekday -- the UI explains that case.
  if (debt) await syncDebtBill(supabase, household.householdId, debt);

  revalidateBudgetPaths();
  return { success: true };
}

/** Manually mirrors an existing debt into Budget -- for debts added before the auto-sync existed. */
export async function syncDebtToBill(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();
  const debtId = formData.get("debt_id") as string;

  const { data: debt, error } = await supabase
    .from("debts")
    .select("id, name, minimum_payment, payment_frequency, due_day, due_weekday")
    .eq("id", debtId)
    .single();

  if (error || !debt) return { error: error?.message ?? "Debt not found." };

  const { synced } = await syncDebtBill(supabase, household.householdId, debt);
  revalidateBudgetPaths();

  if (!synced) return { error: "Add a minimum payment and a due day/weekday to this debt before syncing it to Budget." };
  return { success: true };
}

export async function updateDebt(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();
  const id = formData.get("id") as string;

  const paymentFrequency = (formData.get("payment_frequency") as string) || "monthly";
  const minimumPayment = formData.get("minimum_payment") ? Number(formData.get("minimum_payment")) : null;
  const dueDay = paymentFrequency === "monthly" && formData.get("due_day") ? Number(formData.get("due_day")) : null;
  const dueWeekday = paymentFrequency === "weekly" && formData.get("due_weekday") ? Number(formData.get("due_weekday")) : null;

  const { error } = await supabase
    .from("debts")
    .update({
      name: formData.get("name") as string,
      creditor: (formData.get("creditor") as string) || null,
      interest_rate: formData.get("interest_rate") ? Number(formData.get("interest_rate")) : null,
      minimum_payment: minimumPayment,
      payment_frequency: paymentFrequency,
      due_day: dueDay,
      due_weekday: dueWeekday,
    })
    .eq("id", id)
    .eq("household_id", household.householdId);

  if (error) return { error: error.message };

  revalidateBudgetPaths();
  return { success: true };
}

export async function deleteDebt(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("debts").delete().eq("id", formData.get("id") as string);
  revalidateBudgetPaths();
}

export async function logPayment(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  const debtId = formData.get("debt_id") as string;
  const amount = Number(formData.get("amount"));

  await applyDebtPayment(supabase, debtId, amount, {
    note: formData.get("note") as string,
    paidOn: formData.get("paid_on") as string,
  });

  revalidatePath("/debts");
}

export async function setFocusDebt(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();
  const debtId = formData.get("id") as string;

  await supabase.from("debts").update({ is_focus: false }).eq("household_id", household.householdId);
  await supabase.from("debts").update({ is_focus: true }).eq("id", debtId);

  revalidatePath("/debts");
  revalidatePath("/roundup");
}
