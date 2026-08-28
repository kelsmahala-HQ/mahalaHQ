"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";

function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Remembers a price by item name (survives "Clear checked items", unlike grocery_items itself)
 *  so the next time this item is added, its price can be prefilled automatically. */
async function rememberPrice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  name: string,
  price: number
) {
  await supabase.from("grocery_item_prices").upsert(
    {
      household_id: householdId,
      name_key: nameKey(name),
      display_name: name.trim(),
      last_price: price,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "household_id,name_key" }
  );
}

export async function addItem(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();
  const name = formData.get("name") as string;
  const typedPrice = formData.get("price") ? Number(formData.get("price")) : null;

  let price = typedPrice;
  if (price === null) {
    const { data: remembered } = await supabase
      .from("grocery_item_prices")
      .select("last_price")
      .eq("household_id", household.householdId)
      .eq("name_key", nameKey(name))
      .maybeSingle();
    price = remembered?.last_price ?? null;
  }

  await supabase.from("grocery_items").insert({
    household_id: household.householdId,
    name,
    quantity: formData.get("quantity") as string,
    category: (formData.get("category") as string) || "other",
    price,
    added_by: household.userId,
  });

  if (typedPrice !== null) await rememberPrice(supabase, household.householdId, name, typedPrice);

  revalidatePath("/groceries");
}

/** Looks up the last remembered price for a name, so the Add form can prefill it as you type. */
export async function getRememberedPrice(name: string): Promise<number | null> {
  const household = await requireHousehold();
  const supabase = await createClient();
  if (!name.trim()) return null;

  const { data } = await supabase
    .from("grocery_item_prices")
    .select("last_price")
    .eq("household_id", household.householdId)
    .eq("name_key", nameKey(name))
    .maybeSingle();

  return data?.last_price ?? null;
}

export async function updateItem(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Name the item." };
  const price = formData.get("price") ? Number(formData.get("price")) : null;

  const { error } = await supabase
    .from("grocery_items")
    .update({
      name,
      quantity: (formData.get("quantity") as string) || null,
      category: (formData.get("category") as string) || "other",
      price,
    })
    .eq("id", id)
    .eq("household_id", household.householdId);

  if (error) return { error: error.message };

  if (price !== null) await rememberPrice(supabase, household.householdId, name, price);

  revalidatePath("/groceries");
  return { success: true };
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
