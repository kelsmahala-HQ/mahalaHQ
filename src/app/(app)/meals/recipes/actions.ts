"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";

export async function addRecipe(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Name the recipe." };

  const { data: recipe, error } = await supabase
    .from("recipes")
    .insert({
      household_id: household.householdId,
      name,
      servings: formData.get("servings") ? Number(formData.get("servings")) : null,
      instructions: (formData.get("instructions") as string) || null,
      category: (formData.get("category") as string) || "dinner",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const names = formData.getAll("ingredient_name") as string[];
  const quantities = formData.getAll("ingredient_quantity") as string[];
  const rows = names
    .map((n, i) => ({ name: n.trim(), quantity: (quantities[i] || "").trim() }))
    .filter((r) => r.name)
    .map((r, i) => ({
      household_id: household.householdId,
      recipe_id: recipe.id,
      name: r.name,
      quantity: r.quantity || null,
      position: i,
    }));

  if (rows.length) {
    const { error: ingredientsError } = await supabase.from("recipe_ingredients").insert(rows);
    if (ingredientsError) return { error: ingredientsError.message };
  }

  revalidatePath("/meals/recipes");
  revalidatePath("/meals");
  return { success: true };
}

export async function deleteRecipe(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("recipes").delete().eq("id", formData.get("id") as string);
  revalidatePath("/meals/recipes");
  revalidatePath("/meals");
}
