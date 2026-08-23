"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { applyDebtPayment } from "@/lib/debt-payment";

export async function addDebt(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();
  const balance = Number(formData.get("current_balance"));

  const paymentFrequency = (formData.get("payment_frequency") as string) || "monthly";

  await supabase.from("debts").insert({
    household_id: household.householdId,
    name: formData.get("name") as string,
    creditor: formData.get("creditor") as string,
    original_balance: balance,
    current_balance: balance,
    interest_rate: formData.get("interest_rate") ? Number(formData.get("interest_rate")) : null,
    minimum_payment: formData.get("minimum_payment") ? Number(formData.get("minimum_payment")) : null,
    payment_frequency: paymentFrequency,
    due_day: paymentFrequency === "monthly" && formData.get("due_day") ? Number(formData.get("due_day")) : null,
    due_weekday: paymentFrequency === "weekly" && formData.get("due_weekday") ? Number(formData.get("due_weekday")) : null,
  });

  revalidatePath("/debts");
}

export async function deleteDebt(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("debts").delete().eq("id", formData.get("id") as string);
  revalidatePath("/debts");
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
