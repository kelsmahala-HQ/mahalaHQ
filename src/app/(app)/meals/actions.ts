"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { parseQuantity } from "@/lib/quantity";

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

  revalidatePath("/meals");
  return { success: true };
}

export async function deleteMealPlanEntry(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("meal_plan_entries").delete().eq("id", formData.get("id") as string);
  revalidatePath("/meals");
}

/** Combines same-named ingredients into one line, adding up quantities when the units match
 *  (e.g. "1 onion" + "1 onion" -> "2 onion"). When units differ or a quantity isn't a plain
 *  number, the quantities are listed together instead of guessed at (e.g. "2 cups + 1 tbsp"). */
function combineIngredients(items: { name: string; quantity: string | null }[]): { name: string; quantity: string | null }[] {
  const groups = new Map<string, { displayName: string; quantities: string[] }>();
  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, { displayName: item.name.trim(), quantities: [] });
    if (item.quantity?.trim()) groups.get(key)!.quantities.push(item.quantity.trim());
  }

  return Array.from(groups.values()).map(({ displayName, quantities }) => {
    if (!quantities.length) return { name: displayName, quantity: null };
    if (quantities.length === 1) return { name: displayName, quantity: quantities[0] };

    const parsed = quantities.map(parseQuantity);
    const allParsed = parsed.every((p): p is { amount: number; unit: string } => p !== null);
    const sameUnit = allParsed && parsed.every((p) => p!.unit.toLowerCase() === parsed[0]!.unit.toLowerCase());
    if (allParsed && sameUnit) {
      const total = parsed.reduce((sum, p) => sum + p!.amount, 0);
      return { name: displayName, quantity: parsed[0]!.unit ? `${total} ${parsed[0]!.unit}` : String(total) };
    }
    return { name: displayName, quantity: quantities.join(" + ") };
  });
}

/** Pulls every recipe-based meal planned for the given week into Groceries in one batch --
 *  matches shopping once for the week ahead, instead of items trickling in as meals get planned. */
export async function addWeekToGroceryList(formData: FormData): Promise<{ error: string } | { success: true; count: number }> {
  const household = await requireHousehold();
  const supabase = await createClient();
  const weekStart = formData.get("week_start") as string;
  const weekEnd = formData.get("week_end") as string;

  const { data: entries, error: entriesError } = await supabase
    .from("meal_plan_entries")
    .select("recipe_id")
    .eq("household_id", household.householdId)
    .gte("date", weekStart)
    .lte("date", weekEnd)
    .not("recipe_id", "is", null);

  if (entriesError) return { error: entriesError.message };

  const recipeIds = [...new Set((entries ?? []).map((e) => e.recipe_id as string))];
  if (!recipeIds.length) return { error: "No recipes planned this week yet." };

  const { data: ingredients, error: ingredientsError } = await supabase
    .from("recipe_ingredients")
    .select("name, quantity")
    .in("recipe_id", recipeIds);

  if (ingredientsError) return { error: ingredientsError.message };
  if (!ingredients?.length) return { error: "This week's recipes don't have any ingredients listed." };

  const combined = combineIngredients(ingredients);

  const { error: groceryError } = await supabase.from("grocery_items").insert(
    combined.map((ing) => ({
      household_id: household.householdId,
      name: ing.name,
      quantity: ing.quantity,
      category: "other",
      added_by: household.userId,
    }))
  );

  if (groceryError) return { error: groceryError.message };

  revalidatePath("/groceries");
  return { success: true, count: combined.length };
}
