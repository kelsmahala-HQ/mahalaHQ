import type { Role } from "@/lib/household";

export type NavItem = { href: string; label: string; icon: string; roles?: Role[] };
export type NavGroup = { label: string; items: NavItem[] };

export const DASHBOARD_LINK: NavItem = { href: "/dashboard", label: "Dashboard", icon: "🏠" };

const FULL_ACCESS: Role[] = ["admin", "adult"];
const CAREGIVER_ACCESS: Role[] = ["admin", "adult", "sitter"];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Money",
    items: [
      { href: "/budget", label: "Budget", icon: "💰", roles: FULL_ACCESS },
      { href: "/debts", label: "Debts", icon: "📉", roles: FULL_ACCESS },
      { href: "/roundup", label: "Round-Up", icon: "🪙", roles: FULL_ACCESS },
    ],
  },
  {
    label: "Home",
    items: [
      { href: "/chores", label: "Chores", icon: "🧹" },
      { href: "/maintenance", label: "Maintenance", icon: "🔧", roles: FULL_ACCESS },
      { href: "/groceries", label: "Groceries", icon: "🛒" },
    ],
  },
  {
    label: "Family",
    items: [
      { href: "/calendar", label: "Calendar", icon: "📅" },
      { href: "/family", label: "Family Info", icon: "👨‍👩‍👧‍👦", roles: CAREGIVER_ACCESS },
      { href: "/documents", label: "Documents", icon: "📄", roles: FULL_ACCESS },
      { href: "/contacts", label: "Emergency Contacts", icon: "🚨", roles: CAREGIVER_ACCESS },
    ],
  },
];

/** Filters the nav down to what a given role is allowed to see. Items with no `roles` are visible to everyone. */
export function navGroupsForRole(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}
