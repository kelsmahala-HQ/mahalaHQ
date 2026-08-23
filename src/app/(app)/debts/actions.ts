"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";

export async function addDebt(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();
  const balance = Number(formData.get("current_balance"));

  await supabase.from("debts").insert({
    household_id: household.householdId,
    name: formData.get("name") as string,
    creditor: formData.get("creditor") as string,
    original_balance: balance,
    current_balance: balance,
    interest_rate: formData.get("interest_rate") ? Number(formData.get("interest_rate")) : null,
    minimum_payment: formData.get("minimum_payment") ? Number(formData.get("minimum_payment")) : null,
    due_day: formData.get("due_day") ? Number(formData.get("due_day")) : null,
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

  await supabase.from("debt_payments").insert({
    debt_id: debtId,
    amount,
    paid_on: (formData.get("paid_on") as string) || new Date().toISOString().slice(0, 10),
    note: formData.get("note") as string,
  });

  const { data: debt } = await supabase.from("debts").select("current_balance").eq("id", debtId).single();
  if (debt) {
    const newBalance = Math.max(0, Number(debt.current_balance) - amount);
    await supabase.from("debts").update({ current_balance: newBalance }).eq("id", debtId);
  }

  revalidatePath("/debts");
}
