"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { addReward } from "./rewards-actions";

export default function AddRewardForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await addReward(new FormData(e.currentTarget));

    setLoading(false);
    if ("error" in result) setError(result.error);
    else e.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-slate-500">Reward</label>
        <input name="name" required placeholder="e.g. 15 min extra screen time" className={inputClass} />
      </div>
      <div className="w-28">
        <label className="mb-1 block text-xs font-medium text-slate-500">Cost</label>
        <input name="cost" type="number" min={1} required placeholder="⭐ pts" className={inputClass} />
      </div>
      <button type="submit" disabled={loading} className={buttonClass}>
        {loading ? "Adding..." : "Add"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
