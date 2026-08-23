"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { applyDebtPayment } from "@/lib/debt-payment";

/** Next date (today counts) with this day-of-month, clamped to shorter months (e.g. 31st -> 28th in Feb). */
function nextMonthlyDate(day: number, from: Date): string {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const clampedDay = (y: number, m: number) => Math.min(day, new Date(y, m + 1, 0).getDate());

  let year = today.getFullYear();
  let month = today.getMonth();
  let candidate = new Date(year, month, clampedDay(year, month));

  if (candidate < today) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    candidate = new Date(year, month, clampedDay(year, month));
  }

  return format(candidate, "yyyy-MM-dd");
}

/** Next date (today counts) that falls on this weekday (0=Sunday..6=Saturday). */
function nextWeeklyDate(weekday: number, from: Date): string {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const diff = (weekday - today.getDay() + 7) % 7;
  const candidate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff);
  return format(candidate, "yyyy-MM-dd");
}

export async function addDebt(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();
  const balance = Number(formData.get("current_balance"));

  const paymentFrequency = (formData.get("payment_frequency") as string) || "monthly";
  const minimumPayment = formData.get("minimum_payment") ? Number(formData.get("minimum_payment")) : null;
  const dueDay = paymentFrequency === "monthly" && formData.get("due_day") ? Number(formData.get("due_day")) : null;
  const dueWeekday = paymentFrequency === "weekly" && formData.get("due_weekday") ? Number(formData.get("due_weekday")) : null;

  const { data: debt } = await supabase
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
    .select("id, name")
    .single();

  // Mirror the minimum payment into Budget as a bill, so it shows up in the weekly checklist
  // without having to re-enter it in Manage Bills. Only possible once amount + a due day are set.
  if (debt && minimumPayment && (dueDay || dueWeekday !== null)) {
    const now = new Date();
    const anchor = paymentFrequency === "monthly" ? nextMonthlyDate(dueDay!, now) : nextWeeklyDate(dueWeekday!, now);

    await supabase.from("bills").insert({
      household_id: household.householdId,
      name: `${debt.name} Payment`,
      type: "expense",
      category: "Loan",
      amount: minimumPayment,
      frequency: paymentFrequency,
      due_date: anchor,
      debt_id: debt.id,
    });
  }

  revalidatePath("/debts");
  revalidatePath("/budget");
  revalidatePath("/budget/month");
  revalidatePath("/budget/manage");
}

export async function deleteDebt(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("debts").delete().eq("id", formData.get("id") as string);
  revalidatePath("/debts");
  revalidatePath("/budget");
  revalidatePath("/budget/month");
  revalidatePath("/budget/manage");
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
