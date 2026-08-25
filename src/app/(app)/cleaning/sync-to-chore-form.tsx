"use client";

import { useState } from "react";
import { syncCleaningTaskToChore } from "./actions";

export default function SyncToChoreForm({ cleaningTaskId }: { cleaningTaskId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);

    const result = await syncCleaningTaskToChore(new FormData(form));

    setLoading(false);
    if ("error" in result) setError(result.error);
    else setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
      >
        + Add to Chores
      </button>
    );
  }

  return (
    <div className="text-right">
      <form onSubmit={handleSubmit} className="flex items-center gap-1">
        <input type="hidden" name="cleaning_task_id" value={cleaningTaskId} />
        <input
          name="points"
          type="number"
          min={0}
          placeholder="Points"
          className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-xs focus:border-teal-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-teal-700 px-2 py-0.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {loading ? "..." : "Add"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">
          ✕
        </button>
      </form>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
