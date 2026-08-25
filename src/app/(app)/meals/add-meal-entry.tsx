"use client";

import { useState } from "react";
import { addMealPlanEntry } from "./actions";

export default function AddMealEntry({
  date,
  mealType,
  recipes,
}: {
  date: string;
  mealType: string;
  recipes: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);

    const result = await addMealPlanEntry(new FormData(form));

    setLoading(false);
    if ("error" in result) setError(result.error);
    else {
      form.reset();
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[11px] text-slate-300 hover:text-teal-600">
        + Add
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="meal_type" value={mealType} />
      <select name="recipe_id" defaultValue="" className="w-full rounded border border-slate-200 px-1 py-0.5 text-[11px]">
        <option value="">Custom (type below)</option>
        {recipes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <input name="title" placeholder="Or type a meal" className="w-full rounded border border-slate-200 px-1 py-0.5 text-[11px]" />
      {error && <p className="text-[10px] text-red-600">{error}</p>}
      <div className="flex gap-1">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-teal-700 px-2 py-0.5 text-[10px] font-semibold text-white disabled:opacity-50"
        >
          {loading ? "..." : "Add"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[10px] text-slate-400 hover:text-slate-600">
          Cancel
        </button>
      </div>
    </form>
  );
}
