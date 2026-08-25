"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { addCleaningTask } from "./actions";

export default function AddCleaningTaskForm({ members }: { members: { id: string; display_name: string }[] }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);

    const result = await addCleaningTask(new FormData(form));

    setLoading(false);
    if ("error" in result) setError(result.error);
    else form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input name="title" required placeholder="Task (e.g. Vacuum living room)" className={`${inputClass} sm:col-span-2`} />
      <select name="frequency" defaultValue="weekly" className={inputClass}>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="quarterly">Quarterly</option>
        <option value="yearly">Yearly</option>
      </select>
      <select name="assigned_member_id" defaultValue="" className={inputClass}>
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.display_name}
          </option>
        ))}
      </select>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">First due (optional, defaults to today)</label>
        <input name="next_due_at" type="date" className={inputClass} />
      </div>
      <input name="notes" placeholder="Notes (optional)" className={inputClass} />
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <button type="submit" disabled={loading} className={`${buttonClass} sm:col-span-2`}>
        {loading ? "Adding..." : "Add task"}
      </button>
    </form>
  );
}
