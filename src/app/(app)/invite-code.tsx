"use client";

import { useState } from "react";

export default function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-lg bg-yellow-50 px-3 py-2">
      <p className="text-xs font-medium text-yellow-800">Invite code</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <code className="text-sm font-semibold text-slate-900">{code}</code>
        <button
          onClick={copy}
          className="rounded bg-white px-2 py-1 text-xs font-medium text-teal-700 shadow-sm hover:bg-teal-50"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
