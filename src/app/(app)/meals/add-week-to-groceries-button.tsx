"use client";

import { useState } from "react";
import { addWeekToGroceryList } from "./actions";

export default function AddWeekToGroceriesButton({ weekStart, weekEnd }: { weekStart: string; weekEnd: string }) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setError(null);
    setMessage(null);
    setLoading(true);

    const formData = new FormData();
    formData.set("week_start", weekStart);
    formData.set("week_end", weekEnd);
    const result = await addWeekToGroceryList(formData);

    setLoading(false);
    if ("error" in result) setError(result.error);
    else setMessage(`Added ${result.count} ingredient${result.count === 1 ? "" : "s"} to Groceries.`);
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-50"
      >
        {loading ? "Adding..." : "🛒 Add this week's ingredients to Groceries"}
      </button>
      {message && <p className="mt-1 text-xs text-teal-700">{message}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
