"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import { buttonClass } from "@/components/ui";
import { createLinkToken, exchangePublicToken } from "./plaid-actions";

export default function PlaidLinkButton() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    createLinkToken().then((result) => {
      if ("error" in result) setError(result.error);
      else setLinkToken(result.linkToken);
    });
  }, []);

  const onSuccess = useCallback(
    async (publicToken: string | null, metadata: { institution: { name: string } | null }) => {
      if (!publicToken) return;
      setLoading(true);
      setError(null);
      const result = await exchangePublicToken(publicToken, metadata.institution?.name ?? "Bank account");
      setLoading(false);
      if ("error" in result) setError(result.error);
      else router.refresh();
    },
    [router]
  );

  const { open, ready } = usePlaidLink({ token: linkToken ?? "", onSuccess });

  return (
    <div>
      <button onClick={() => open()} disabled={!ready || loading} className={buttonClass}>
        {loading ? "Connecting..." : "Connect a bank account"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
