"use client";

import { useState } from "react";
import Link from "next/link";
import { DASHBOARD_LINK, type NavGroup } from "./nav";
import InviteCode from "./invite-code";

export default function MobileNav({
  navGroups,
  isKid,
  inviteCode,
  householdName,
}: {
  navGroups: NavGroup[];
  isKid: boolean;
  inviteCode: string;
  householdName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-teal-50"
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-10 max-h-[80vh] overflow-y-auto border-b border-slate-200 bg-white px-4 py-3 shadow-lg">
          <Link
            href={DASHBOARD_LINK.href}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 hover:bg-teal-50 hover:text-teal-700"
          >
            <span>{DASHBOARD_LINK.icon}</span>
            {DASHBOARD_LINK.label}
          </Link>
          {navGroups.map((group) => (
            <div key={group.label} className="mt-3">
              <p className="px-2 text-xs font-medium uppercase tracking-wide text-slate-400">{group.label}</p>
              <div className="mt-1 space-y-1">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 hover:bg-teal-50 hover:text-teal-700"
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {!isKid && (
            <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
              <InviteCode code={inviteCode} householdName={householdName} />
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="block px-2 text-xs font-medium text-slate-500 hover:text-teal-600"
              >
                ⚙️ Household members
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
