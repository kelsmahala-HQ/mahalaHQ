"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";
import { agreeToContract } from "./actions";

export default function AgreeButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await agreeToContract();
    setLoading(false);
    if ("error" in result) setError(result.error);
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={loading} className={buttonClass}>
        {loading ? "Saving…" : "I've read this and I agree"}
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
