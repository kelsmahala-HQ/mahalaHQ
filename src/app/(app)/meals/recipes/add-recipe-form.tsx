"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { addRecipe } from "./actions";
import { RECIPE_CATEGORIES } from "@/lib/recipe-categories";
import type { ExtractedRecipe } from "@/lib/recipe-extract";

export default function AddRecipeForm({
  initial,
  onSaved,
}: {
  initial?: ExtractedRecipe | null;
  onSaved?: () => void;
}) {
  const [ingredientCount, setIngredientCount] = useState(Math.max(3, initial?.ingredients.length ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);

    const result = await addRecipe(new FormData(form));

    setLoading(false);
    if ("error" in result) setError(result.error);
    else {
      form.reset();
      setIngredientCount(3);
      onSaved?.();
    }
  }

  const ingredients = initial?.ingredients ?? [];

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="name" required placeholder="Recipe name" defaultValue={initial?.name ?? ""} className={inputClass} />
        <input
          name="servings"
          type="number"
          min={1}
          placeholder="Servings (optional)"
          defaultValue={initial?.servings ?? undefined}
          className={inputClass}
        />
        <select name="category" defaultValue={initial?.category ?? "dinner"} className={`${inputClass} sm:col-span-2`}>
          {RECIPE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.icon} {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Ingredients</label>
        <div className="space-y-2">
          {Array.from({ length: ingredientCount }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <input
                name="ingredient_quantity"
                placeholder="Amount (e.g. 2 cups)"
                defaultValue={ingredients[i]?.quantity ?? ""}
                className={`${inputClass} w-32`}
              />
              <input name="ingredient_name" placeholder="Ingredient" defaultValue={ingredients[i]?.name ?? ""} className={inputClass} />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setIngredientCount((c) => c + 1)}
          className="mt-2 text-xs font-medium text-teal-600 hover:text-teal-500"
        >
          + Add another ingredient
        </button>
      </div>

      <textarea
        name="instructions"
        placeholder="Instructions (optional)"
        rows={4}
        defaultValue={initial?.instructions ?? ""}
        className={inputClass}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className={buttonClass}>
        {loading ? "Saving..." : initial ? "Save reviewed recipe" : "Save recipe"}
      </button>
    </form>
  );
}
