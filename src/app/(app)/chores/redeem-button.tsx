"use client";

import { useState } from "react";
import { requestRedemption } from "./rewards-actions";

export default function RedeemButton({ rewardId, canAfford }: { rewardId: string; canAfford: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "requested" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setState("loading");
    setError(null);
    const fd = new FormData();
    fd.set("reward_id", rewardId);
    const result = await requestRedemption(fd);
    if ("error" in result) {
      setError(result.error);
      setState("error");
    } else {
      setState("requested");
    }
  }

  if (state === "requested") {
    return (
      <button disabled className="w-full rounded-xl bg-slate-100 py-2 text-xs font-bold text-slate-400">
        Waiting for approval
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={!canAfford || state === "loading"}
        className={`w-full rounded-xl py-2 text-xs font-bold ${
          canAfford ? "bg-teal-500 text-white hover:bg-teal-600" : "cursor-not-allowed bg-slate-100 text-slate-400"
        }`}
      >
        {state === "loading" ? "Requesting..." : canAfford ? "Redeem" : "Not enough yet"}
      </button>
      {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
