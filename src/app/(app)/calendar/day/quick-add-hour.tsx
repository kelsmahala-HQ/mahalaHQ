"use client";

import { useState } from "react";
import { quickAddHourEvent } from "./actions";

export default function QuickAddHour({ date, hour }: { date: string; hour: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);

    const result = await quickAddHourEvent(new FormData(form));

    setLoading(false);
    if ("error" in result) setError(result.error);
    else form.reset();
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="hour" value={hour} />
        <input
          name="title"
          placeholder="+ type here..."
          disabled={loading}
          className="w-full rounded border-none bg-transparent px-1 py-0.5 text-xs text-slate-700 placeholder:text-slate-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-300"
        />
      </form>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
