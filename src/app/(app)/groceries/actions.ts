"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";

export async function addItem(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();

  await supabase.from("grocery_items").insert({
    household_id: household.householdId,
    name: formData.get("name") as string,
    quantity: formData.get("quantity") as string,
    category: (formData.get("category") as string) || "other",
    added_by: household.userId,
  });

  revalidatePath("/groceries");
}

export async function toggleItem(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const isChecked = formData.get("isChecked") === "true";
  await supabase.from("grocery_items").update({ is_checked: !isChecked }).eq("id", id);
  revalidatePath("/groceries");
}

export async function deleteItem(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("grocery_items").delete().eq("id", formData.get("id") as string);
  revalidatePath("/groceries");
}

export async function clearChecked() {
  const household = await requireHousehold();
  const supabase = await createClient();
  await supabase
    .from("grocery_items")
    .delete()
    .eq("household_id", household.householdId)
    .eq("is_checked", true);
  revalidatePath("/groceries");
}
