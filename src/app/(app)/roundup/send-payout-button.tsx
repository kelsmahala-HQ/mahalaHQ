"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";
import { sendPayout } from "./actions";

export default function SendPayoutButton({ debtId, amount, debtName }: { debtId: string; amount: number; debtName: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.set("debt_id", debtId);
    fd.set("amount", String(amount));
    const result = await sendPayout(fd);

    if ("error" in result) {
      setError(result.error);
      setLoading(false);
    }
    // On success the page revalidates and this button disappears (readyToSend goes false) --
    // leaving loading=true until then avoids a second click slipping in during that gap.
  }

  return (
    <div className="mt-4">
      <button type="button" onClick={handleClick} disabled={loading} className={buttonClass}>
        {loading ? "Sending..." : `Send ${amount.toLocaleString("en-US", { style: "currency", currency: "USD" })} to ${debtName} 🎉`}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <p className="mt-1 text-xs text-slate-400">
        This logs the payment here — you still need to actually send the money yourself.
      </p>
    </div>
  );
}
