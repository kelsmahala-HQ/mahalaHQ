export type NavItem = { href: string; label: string; icon: string; adultOnly?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

export const DASHBOARD_LINK: NavItem = { href: "/dashboard", label: "Dashboard", icon: "🏠" };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Money",
    items: [
      { href: "/budget", label: "Budget", icon: "💰", adultOnly: true },
      { href: "/debts", label: "Debts", icon: "📉", adultOnly: true },
      { href: "/roundup", label: "Round-Up", icon: "🪙", adultOnly: true },
    ],
  },
  {
    label: "Home",
    items: [
      { href: "/chores", label: "Chores", icon: "🧹" },
      { href: "/maintenance", label: "Maintenance", icon: "🔧", adultOnly: true },
      { href: "/groceries", label: "Groceries", icon: "🛒" },
    ],
  },
  {
    label: "Family",
    items: [
      { href: "/calendar", label: "Calendar", icon: "📅" },
      { href: "/family", label: "Family Info", icon: "👨‍👩‍👧‍👦", adultOnly: true },
      { href: "/documents", label: "Documents", icon: "📄", adultOnly: true },
      { href: "/contacts", label: "Emergency Contacts", icon: "🚨", adultOnly: true },
    ],
  },
];

/** Kids only see non-financial, non-sensitive sections. */
export function navGroupsForRole(role: string): NavGroup[] {
  if (role !== "kid") return NAV_GROUPS;
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adultOnly),
  })).filter((group) => group.items.length > 0);
}
