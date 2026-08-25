"use client";

import { useState } from "react";
import { addTask, deleteTask, toggleTask } from "./actions";

type Task = { id: string; text: string; is_done: boolean };

export default function TaskList({ date, kind, tasks }: { date: string; kind: "todo" | "followup"; tasks: Task[] }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);

    const result = await addTask(new FormData(form));

    setLoading(false);
    if ("error" in result) setError(result.error);
    else form.reset();
  }

  return (
    <div>
      <div className="space-y-1.5">
        {tasks.map((t) => (
          <div key={t.id} className="flex items-center gap-2">
            <form action={toggleTask}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="is_done" value={String(t.is_done)} />
              <button
                type="submit"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                  t.is_done ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 text-transparent"
                }`}
              >
                ✓
              </button>
            </form>
            <span className={`flex-1 text-sm ${t.is_done ? "text-slate-400 line-through" : "text-slate-800"}`}>{t.text}</span>
            <form action={deleteTask}>
              <input type="hidden" name="id" value={t.id} />
              <button type="submit" className="text-xs text-slate-300 hover:text-red-500">
                ✕
              </button>
            </form>
          </div>
        ))}
        {!tasks.length && <p className="text-xs text-slate-400">Nothing here yet.</p>}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="kind" value={kind} />
        <input
          name="text"
          placeholder="Type and press Enter..."
          disabled={loading}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none"
        />
      </form>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
