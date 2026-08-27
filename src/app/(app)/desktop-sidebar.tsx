"use client";

import { useState } from "react";
import Link from "next/link";
import SignOutButton from "./sign-out-button";
import InviteCode from "./invite-code";
import { DASHBOARD_LINK, type NavGroup } from "./nav";

export default function DesktopSidebar({
  navGroups,
  showManagement,
  inviteCode,
  householdName,
  displayName,
}: {
  navGroups: NavGroup[];
  showManagement: boolean;
  inviteCode: string;
  householdName: string;
  displayName: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={open ? "Collapse menu" : "Expand menu"}
        aria-label="Toggle menu"
        className="fixed left-3 top-3 z-20 hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-teal-50 sm:flex"
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 pt-14 sm:flex">
          <div className="mb-6 border-l-4 border-yellow-400 px-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Household</p>
            <p className="truncate text-lg font-semibold text-slate-900">{householdName}</p>
          </div>
          <nav className="flex-1 space-y-4">
            <Link
              href={DASHBOARD_LINK.href}
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 hover:bg-teal-50 hover:text-teal-700"
            >
              <span>{DASHBOARD_LINK.icon}</span>
              {DASHBOARD_LINK.label}
            </Link>
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="px-2 text-xs font-medium uppercase tracking-wide text-slate-400">{group.label}</p>
                <div className="mt-1 space-y-1">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 hover:bg-teal-50 hover:text-teal-700"
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
            {showManagement && <InviteCode code={inviteCode} householdName={householdName} />}
            {showManagement && (
              <Link href="/settings" className="block px-2 text-xs font-medium text-slate-500 hover:text-teal-600">
                ⚙️ Household members
              </Link>
            )}
            <p className="px-2 text-xs text-slate-400">Signed in as {displayName}</p>
            <SignOutButton />
          </div>
        </aside>
      )}
    </>
  );
}
