import { requireHousehold } from "@/lib/household";
import SignOutButton from "./sign-out-button";
import MobileNav from "./mobile-nav";
import DesktopSidebar from "./desktop-sidebar";
import { navGroupsForRole } from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const household = await requireHousehold();
  const navGroups = navGroupsForRole(household.role);
  const showManagement = household.role === "admin" || household.role === "adult";

  return (
    <div className="flex min-h-screen bg-slate-50">
      <DesktopSidebar
        navGroups={navGroups}
        showManagement={showManagement}
        inviteCode={household.inviteCode}
        householdName={household.householdName}
        displayName={household.displayName}
      />

      <div className="flex-1">
        <header className="relative flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:hidden">
          <div className="flex items-center gap-2">
            <MobileNav
              navGroups={navGroups}
              showManagement={showManagement}
              inviteCode={household.inviteCode}
              householdName={household.householdName}
            />
            <span className="font-semibold text-slate-900">{household.householdName}</span>
          </div>
          <SignOutButton />
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
