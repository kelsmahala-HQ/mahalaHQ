import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { EmptyState, PageHeader } from "@/components/ui";
import { RECIPE_CATEGORIES, RECIPE_CATEGORY_LABELS } from "@/lib/recipe-categories";
import RecipeFormPanel from "./recipe-form-panel";
import RecipeCard from "./recipe-card";

export default async function RecipesPage() {
  const household = await requireHousehold();
  const supabase = await createClient();

  const [{ data: recipes }, { data: ingredients }] = await Promise.all([
    supabase.from("recipes").select("*").eq("household_id", household.householdId).order("name"),
    supabase.from("recipe_ingredients").select("*").eq("household_id", household.householdId).order("position"),
  ]);

  const ingredientsByRecipe = new Map<string, NonNullable<typeof ingredients>>();
  for (const ing of ingredients ?? []) {
    if (!ingredientsByRecipe.has(ing.recipe_id)) ingredientsByRecipe.set(ing.recipe_id, []);
    ingredientsByRecipe.get(ing.recipe_id)!.push(ing);
  }

  const knownCategories = new Set(RECIPE_CATEGORIES.map((c) => c.value));
  const recipesByCategory = new Map<string, NonNullable<typeof recipes>>();
  for (const r of recipes ?? []) {
    const key = knownCategories.has(r.category) ? r.category : "other";
    if (!recipesByCategory.has(key)) recipesByCategory.set(key, []);
    recipesByCategory.get(key)!.push(r);
  }
  const orderedCategoryKeys = [...RECIPE_CATEGORIES.map((c) => c.value), "other"];

  return (
    <div>
      <PageHeader title="Recipe Box" subtitle="Recipes you can drop straight into the meal planner." />

      <div className="mb-6">
        <Link href="/meals" className="text-sm font-medium text-teal-600 hover:underline">
          ← Back to Meal Planner
        </Link>
      </div>

      <RecipeFormPanel />

      {!recipes?.length ? (
        <EmptyState message="No recipes yet — add one above." />
      ) : (
        <div className="space-y-8">
          {orderedCategoryKeys.map((key) => {
            const inCategory = recipesByCategory.get(key);
            if (!inCategory?.length) return null;
            const info = RECIPE_CATEGORY_LABELS[key] ?? { label: "Other", icon: "🍴" };
            return (
              <div key={key}>
                <h2 className="mb-3 text-sm font-semibold text-slate-700">
                  {info.icon} {info.label}
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {inCategory.map((r) => (
                    <RecipeCard key={r.id} recipe={r} ingredients={ingredientsByRecipe.get(r.id) ?? []} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
