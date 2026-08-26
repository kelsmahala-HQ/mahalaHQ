"use client";

import { useState } from "react";
import { Card, iconButtonClass } from "@/components/ui";
import { scaleQuantity } from "@/lib/quantity";
import { deleteRecipe, updateRecipe } from "./actions";
import AddRecipeForm from "./add-recipe-form";

type Ingredient = { id: string; name: string; quantity: string | null };
type Recipe = { id: string; name: string; servings: number | null; instructions: string | null; category: string };

export default function RecipeCard({ recipe, ingredients }: { recipe: Recipe; ingredients: Ingredient[] }) {
  const [editing, setEditing] = useState(false);
  const baseServings = recipe.servings;
  const [servings, setServings] = useState(baseServings ?? 1);
  const factor = baseServings ? servings / baseServings : 1;

  if (editing) {
    return (
      <Card>
        <AddRecipeForm
          recipeId={recipe.id}
          action={updateRecipe}
          initial={{
            name: recipe.name,
            servings: recipe.servings,
            instructions: recipe.instructions,
            category: recipe.category,
            ingredients: ingredients.map((i) => ({ name: i.name, quantity: i.quantity })),
          }}
          onSaved={() => setEditing(false)}
        />
        <button type="button" onClick={() => setEditing(false)} className="mt-2 text-xs text-slate-500 hover:text-slate-700">
          Cancel
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{recipe.name}</p>
          {baseServings ? (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Servings:</span>
              <button
                type="button"
                onClick={() => setServings((s) => Math.max(1, s - 1))}
                className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-xs text-slate-500 hover:bg-slate-50"
              >
                −
              </button>
              <span className="w-5 text-center text-xs font-semibold text-slate-700">{servings}</span>
              <button
                type="button"
                onClick={() => setServings((s) => s + 1)}
                className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-xs text-slate-500 hover:bg-slate-50"
              >
                +
              </button>
              {servings !== baseServings && (
                <button type="button" onClick={() => setServings(baseServings)} className="text-xs text-teal-600 hover:underline">
                  Reset to {baseServings}
                </button>
              )}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-teal-600 hover:text-teal-500">
            Edit
          </button>
          <form action={deleteRecipe}>
            <input type="hidden" name="id" value={recipe.id} />
            <button className={iconButtonClass}>Remove</button>
          </form>
        </div>
      </div>
      {!!ingredients.length && (
        <ul className="mb-2 space-y-0.5 text-sm text-slate-600">
          {ingredients.map((ing) => (
            <li key={ing.id}>
              • {ing.quantity ? `${factor !== 1 ? scaleQuantity(ing.quantity, factor) : ing.quantity} ` : ""}
              {ing.name}
            </li>
          ))}
        </ul>
      )}
      {recipe.instructions && <p className="whitespace-pre-wrap text-xs text-slate-500">{recipe.instructions}</p>}
    </Card>
  );
}
