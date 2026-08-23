"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { syncLiabilities } from "./plaid-actions";

export default function SyncLiabilitiesButton() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    setStatus(null);
    const result = await syncLiabilities();
    setLoading(false);

    if ("error" in result) {
      setStatus(result.error);
    } else {
      setStatus(`Synced ${result.synced} account${result.synced === 1 ? "" : "s"} from your bank.`);
      router.refresh();
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-50"
      >
        {loading ? "Syncing..." : "🔄 Sync balances from bank"}
      </button>
      {status && <p className="mt-1 text-xs text-slate-500">{status}</p>}
    </div>
  );
}
