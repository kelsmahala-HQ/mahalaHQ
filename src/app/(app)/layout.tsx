import Link from "next/link";
import { requireHousehold } from "@/lib/household";
import SignOutButton from "./sign-out-button";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/budget", label: "Budget", icon: "💰" },
  { href: "/debts", label: "Debts", icon: "📉" },
  { href: "/chores", label: "Chores", icon: "🧹" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/groceries", label: "Groceries", icon: "🛒" },
  { href: "/maintenance", label: "Maintenance", icon: "🔧" },
  { href: "/documents", label: "Documents", icon: "📄" },
  { href: "/family", label: "Family", icon: "👨‍👩‍👧‍👦" },
  { href: "/contacts", label: "Emergency Contacts", icon: "🚨" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const household = await requireHousehold();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 sm:flex">
        <div className="mb-6 border-l-4 border-yellow-400 px-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Household</p>
          <p className="truncate text-lg font-semibold text-slate-900">{household.householdName}</p>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 hover:bg-teal-50 hover:text-teal-700"
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="px-2 text-xs text-slate-400">Signed in as {household.displayName}</p>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:hidden">
          <span className="font-semibold text-slate-900">{household.householdName}</span>
          <SignOutButton />
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
