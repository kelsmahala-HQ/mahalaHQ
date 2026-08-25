"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";

export async function addMealPlanEntry(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();

  const date = formData.get("date") as string;
  const mealType = formData.get("meal_type") as string;
  const recipeId = (formData.get("recipe_id") as string) || null;
  const customTitle = ((formData.get("title") as string) || "").trim();

  let title = customTitle;
  if (recipeId) {
    const { data: recipe } = await supabase.from("recipes").select("name").eq("id", recipeId).maybeSingle();
    if (!recipe) return { error: "Recipe not found." };
    title = recipe.name;
  }

  if (!title) return { error: "Pick a recipe or type a meal." };

  const { error } = await supabase.from("meal_plan_entries").insert({
    household_id: household.householdId,
    date,
    meal_type: mealType,
    recipe_id: recipeId,
    title,
  });

  if (error) return { error: error.message };

  // Automatically add the recipe's ingredients to the grocery list.
  if (recipeId) {
    const { data: ingredients } = await supabase.from("recipe_ingredients").select("name, quantity").eq("recipe_id", recipeId);
    if (ingredients?.length) {
      const { error: groceryError } = await supabase.from("grocery_items").insert(
        ingredients.map((ing) => ({
          household_id: household.householdId,
          name: ing.name,
          quantity: ing.quantity,
          category: "other",
          added_by: household.userId,
        }))
      );
      if (groceryError) return { error: `Meal saved, but couldn't add ingredients to Groceries: ${groceryError.message}` };
    }
  }

  revalidatePath("/meals");
  revalidatePath("/groceries");
  return { success: true };
}

export async function deleteMealPlanEntry(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("meal_plan_entries").delete().eq("id", formData.get("id") as string);
  revalidatePath("/meals");
}
