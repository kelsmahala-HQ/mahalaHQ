"use client";

import { useState } from "react";

export default function FeedLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/calendar-feed/${token}` : "";

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-lg bg-slate-100 px-2 py-1.5 text-xs text-slate-600">{url}</code>
      <button
        onClick={copy}
        className="shrink-0 rounded-lg bg-teal-50 px-2 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
