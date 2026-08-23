"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";

export async function addBill(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();
  const frequency = (formData.get("frequency") as string) || "monthly";
  const amount = Number(formData.get("amount"));
  const dueDate = formData.get("due_date") as string;

  const { data: bill, error: billError } = await supabase
    .from("bills")
    .insert({
      household_id: household.householdId,
      name: formData.get("name") as string,
      type: (formData.get("type") as string) || "expense",
      category: (formData.get("category") as string) || "Other",
      amount,
      frequency,
      due_date: dueDate,
      assigned_to: (formData.get("assigned_to") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single();

  if (billError || !bill) return { error: billError?.message ?? "Could not add bill." };

  // A one-time bill is just a transaction -- record it as already paid immediately.
  if (frequency === "once") {
    const { error: paymentError } = await supabase.from("bill_payments").insert({
      bill_id: bill.id,
      household_id: household.householdId,
      amount,
      paid_on: dueDate,
    });
    if (paymentError) return { error: paymentError.message };
  }

  revalidatePath("/budget");
  revalidatePath("/calendar");
  return { success: true };
}

export async function updateBill(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  const id = formData.get("id") as string;

  await supabase
    .from("bills")
    .update({
      name: formData.get("name") as string,
      category: (formData.get("category") as string) || "Other",
      amount: Number(formData.get("amount")),
      frequency: (formData.get("frequency") as string) || "monthly",
      due_date: formData.get("due_date") as string,
      assigned_to: (formData.get("assigned_to") as string) || null,
    })
    .eq("id", id);

  revalidatePath("/budget");
  revalidatePath("/calendar");
  revalidatePath("/calendar");
}

export async function deleteBill(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("bills").delete().eq("id", formData.get("id") as string);
  revalidatePath("/budget");
  revalidatePath("/calendar");
}

export async function markBillPaid(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();

  await supabase.from("bill_payments").insert({
    bill_id: formData.get("bill_id") as string,
    household_id: household.householdId,
    amount: Number(formData.get("amount")),
    paid_on: (formData.get("paid_on") as string) || new Date().toISOString().slice(0, 10),
  });

  revalidatePath("/budget");
}

export async function deleteBillPayment(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("bill_payments").delete().eq("id", formData.get("id") as string);
  revalidatePath("/budget");
}
