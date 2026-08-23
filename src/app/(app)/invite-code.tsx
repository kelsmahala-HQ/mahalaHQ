"use client";

import { useState } from "react";

export default function InviteCode({ code, householdName }: { code: string; householdName: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
  const subject = `Join ${householdName} on Family Portal`;
  const body = `Hey! Join our household on Family Portal so we can keep track of chores, the calendar, and more together.\n\n1. Go to ${siteUrl}\n2. Sign up for an account\n3. Choose "Have an invite code? Join instead" and enter: ${code}`;
  const mailtoHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

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
      <a
        href={mailtoHref}
        className="mt-2 block rounded bg-white px-2 py-1.5 text-center text-xs font-medium text-teal-700 shadow-sm hover:bg-teal-50"
      >
        ✉️ Invite by email
      </a>
    </div>
  );
}
