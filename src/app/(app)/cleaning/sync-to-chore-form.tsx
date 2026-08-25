"use client";

import { useState } from "react";
import { syncCleaningTaskToChore } from "./actions";

export default function SyncToChoreForm({ cleaningTaskId }: { cleaningTaskId: string }) {
  const [withPoints, setWithPoints] = useState(false);
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
  }

  return (
    <div className="text-right">
      <form onSubmit={handleSubmit} className="flex items-center gap-1">
        <input type="hidden" name="cleaning_task_id" value={cleaningTaskId} />
        {withPoints && (
          <input
            name="points"
            type="number"
            min={0}
            placeholder="Points"
            autoFocus
            className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-xs focus:border-teal-500 focus:outline-none"
          />
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-50"
        >
          {loading ? "..." : "+ Add to Chores"}
        </button>
        {!withPoints && (
          <button type="button" onClick={() => setWithPoints(true)} className="text-xs text-slate-400 hover:text-teal-600">
            + points
          </button>
        )}
      </form>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
