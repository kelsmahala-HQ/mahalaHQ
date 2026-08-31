export const GROCERY_CATEGORIES = [
  { value: "produce", label: "Produce", icon: "🥬" },
  { value: "dairy", label: "Dairy", icon: "🥛" },
  { value: "meat", label: "Meat & Seafood", icon: "🥩" },
  { value: "bakery", label: "Bakery", icon: "🍞" },
  { value: "frozen", label: "Frozen", icon: "❄️" },
  { value: "pantry", label: "Pantry", icon: "🥫" },
  { value: "beverages", label: "Beverages", icon: "🥤" },
  { value: "snacks", label: "Snacks", icon: "🍿" },
  { value: "household", label: "Household", icon: "🧻" },
  { value: "personal_care", label: "Personal Care", icon: "🧴" },
  { value: "other", label: "Other", icon: "🛒" },
] as const;

export const GROCERY_CATEGORY_LABELS: Record<string, { label: string; icon: string }> = Object.fromEntries(
  GROCERY_CATEGORIES.map((c) => [c.value, { label: c.label, icon: c.icon }])
);

export const GROCERY_CATEGORY_VALUES = GROCERY_CATEGORIES.map((c) => c.value);
