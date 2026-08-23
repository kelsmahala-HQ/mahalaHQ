export type NavItem = { href: string; label: string; icon: string };
export type NavGroup = { label: string; items: NavItem[] };

export const DASHBOARD_LINK: NavItem = { href: "/dashboard", label: "Dashboard", icon: "🏠" };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Money",
    items: [
      { href: "/budget", label: "Budget", icon: "💰" },
      { href: "/debts", label: "Debts", icon: "📉" },
    ],
  },
  {
    label: "Home",
    items: [
      { href: "/chores", label: "Chores", icon: "🧹" },
      { href: "/maintenance", label: "Maintenance", icon: "🔧" },
      { href: "/groceries", label: "Groceries", icon: "🛒" },
    ],
  },
  {
    label: "Family",
    items: [
      { href: "/calendar", label: "Calendar", icon: "📅" },
      { href: "/family", label: "Family Info", icon: "👨‍👩‍👧‍👦" },
      { href: "/documents", label: "Documents", icon: "📄" },
      { href: "/contacts", label: "Emergency Contacts", icon: "🚨" },
    ],
  },
];
