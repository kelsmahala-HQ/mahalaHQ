import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { Card, EmptyState, PageHeader, iconButtonClass } from "@/components/ui";
import { deleteRecipe } from "./actions";
import RecipeFormPanel from "./recipe-form-panel";

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {recipes.map((r) => {
            const ings = ingredientsByRecipe.get(r.id) ?? [];
            return (
              <Card key={r.id}>
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{r.name}</p>
                    {r.servings && <p className="text-xs text-slate-400">Serves {r.servings}</p>}
                  </div>
                  <form action={deleteRecipe}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className={iconButtonClass}>Remove</button>
                  </form>
                </div>
                {!!ings.length && (
                  <ul className="mb-2 space-y-0.5 text-sm text-slate-600">
                    {ings.map((ing) => (
                      <li key={ing.id}>
                        • {ing.quantity ? `${ing.quantity} ` : ""}
                        {ing.name}
                      </li>
                    ))}
                  </ul>
                )}
                {r.instructions && <p className="whitespace-pre-wrap text-xs text-slate-500">{r.instructions}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
