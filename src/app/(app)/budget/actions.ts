"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";

export async function addCategory(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();

  await supabase.from("budget_categories").insert({
    household_id: household.householdId,
    name: formData.get("name") as string,
    type: (formData.get("type") as string) || "expense",
    monthly_limit: formData.get("monthly_limit") ? Number(formData.get("monthly_limit")) : null,
  });

  revalidatePath("/budget");
}

export async function deleteCategory(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("budget_categories").delete().eq("id", formData.get("id") as string);
  revalidatePath("/budget");
}

export async function addTransaction(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();
  const categoryId = formData.get("category_id") as string;

  await supabase.from("budget_transactions").insert({
    household_id: household.householdId,
    category_id: categoryId || null,
    amount: Number(formData.get("amount")),
    description: formData.get("description") as string,
    occurred_on: (formData.get("occurred_on") as string) || new Date().toISOString().slice(0, 10),
    created_by: household.userId,
  });

  revalidatePath("/budget");
}

export async function deleteTransaction(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("budget_transactions").delete().eq("id", formData.get("id") as string);
  revalidatePath("/budget");
}
