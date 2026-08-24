"use client";

import { useState } from "react";
import { syncDebtToBill } from "./actions";

export default function SyncToBudgetButton({ debtId }: { debtId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setError(null);
    setLoading(true);
    const result = await syncDebtToBill((() => {
      const fd = new FormData();
      fd.set("debt_id", debtId);
      return fd;
    })());
    setLoading(false);
    if ("error" in result) setError(result.error);
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-50"
      >
        {loading ? "Adding..." : "+ Add to Budget"}
      </button>
      {error && <p className="mt-1 max-w-[220px] text-xs text-red-600">{error}</p>}
    </div>
  );
}
