"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { addChore } from "./actions";

export default function AddChoreForm({ members }: { members: { id: string; display_name: string }[] }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);

    const result = await addChore(new FormData(form));

    setLoading(false);
    if ("error" in result) setError(result.error);
    else form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input name="title" required placeholder="Chore (e.g. Take out trash)" className={inputClass} />
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-500">Who (pick one or more, or leave unassigned)</label>
        <div className="flex flex-wrap gap-3">
          {members?.map((m) => (
            <label key={m.id} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="checkbox" name="assigned_member_id" value={m.id} className="accent-teal-600" />
              {m.display_name}
            </label>
          ))}
        </div>
      </div>
      <select name="frequency" className={inputClass} defaultValue="weekly">
        <option value="once">One-time</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
      <input name="points" type="number" min={0} placeholder="Points (optional)" className={inputClass} />
      <input name="due_date" type="date" className={inputClass} />
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <button type="submit" disabled={loading} className={`${buttonClass} sm:col-span-2`}>
        {loading ? "Adding..." : "Add chore"}
      </button>
    </form>
  );
}
