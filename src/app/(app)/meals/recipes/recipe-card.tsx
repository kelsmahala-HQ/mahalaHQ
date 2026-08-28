"use client";

import { useRef, useState } from "react";
import { Card, iconButtonClass } from "@/components/ui";
import { scaleQuantity } from "@/lib/quantity";
import { deleteRecipe, updateRecipe } from "./actions";
import AddRecipeForm from "./add-recipe-form";

type Ingredient = { id: string; name: string; quantity: string | null };
type Recipe = { id: string; name: string; servings: number | null; instructions: string | null; category: string };

export default function RecipeCard({ recipe, ingredients }: { recipe: Recipe; ingredients: Ingredient[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState(false);
  const baseServings = recipe.servings;
  const [servings, setServings] = useState(baseServings ?? 1);
  const factor = baseServings ? servings / baseServings : 1;

  function close() {
    dialogRef.current?.close();
    setEditing(false);
  }

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className="w-full text-left" title="Click to view the full recipe">
        <Card className="transition hover:border-teal-300 hover:shadow-md">
          <p className="font-medium text-slate-900">{recipe.name}</p>
          <p className="mt-1 text-xs text-slate-400">
            {[
              baseServings ? `Serves ${baseServings}` : null,
              ingredients.length ? `${ingredients.length} ingredient${ingredients.length === 1 ? "" : "s"}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Click to view"}
          </p>
        </Card>
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        onClose={() => setEditing(false)}
        className="w-[92vw] max-w-2xl rounded-xl border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/40"
      >
        <div className="max-h-[85vh] overflow-y-auto p-6">
          {editing ? (
            <>
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
                onSaved={close}
              />
              <button type="button" onClick={() => setEditing(false)} className="mt-2 text-sm text-slate-500 hover:text-slate-700">
                Cancel
              </button>
            </>
          ) : (
            <>
              <div className="mb-3 flex items-start justify-between gap-2">
                <h3 className="text-xl font-semibold text-slate-900 break-words">{recipe.name}</h3>
                <button type="button" onClick={close} className="shrink-0 text-slate-400 hover:text-slate-600" aria-label="Close">
                  ✕
                </button>
              </div>

              {baseServings ? (
                <div className="mb-3 flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Servings:</span>
                  <button
                    type="button"
                    onClick={() => setServings((s) => Math.max(1, s - 1))}
                    className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-semibold text-slate-700">{servings}</span>
                  <button
                    type="button"
                    onClick={() => setServings((s) => s + 1)}
                    className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
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

              {!!ingredients.length && (
                <ul className="mb-4 space-y-1.5 text-base text-slate-700">
                  {ingredients.map((ing) => (
                    <li key={ing.id}>
                      • {ing.quantity ? `${factor !== 1 ? scaleQuantity(ing.quantity, factor) : ing.quantity} ` : ""}
                      {ing.name}
                    </li>
                  ))}
                </ul>
              )}

              {recipe.instructions && <p className="mb-5 whitespace-pre-wrap text-base leading-relaxed text-slate-600">{recipe.instructions}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
                >
                  Edit
                </button>
                <form action={deleteRecipe}>
                  <input type="hidden" name="id" value={recipe.id} />
                  <button type="submit" className={iconButtonClass}>
                    Remove
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
