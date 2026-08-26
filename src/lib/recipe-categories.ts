export const RECIPE_CATEGORIES = [
  { value: "breakfast", label: "Breakfast", icon: "🍳" },
  { value: "lunch", label: "Lunch", icon: "🥪" },
  { value: "dinner", label: "Dinner", icon: "🍽️" },
  { value: "side", label: "Side", icon: "🥗" },
  { value: "dessert", label: "Dessert", icon: "🍰" },
  { value: "crockpot", label: "Crockpot", icon: "🍲" },
  { value: "snack", label: "Snack", icon: "🍿" },
] as const;

export const RECIPE_CATEGORY_VALUES = RECIPE_CATEGORIES.map((c) => c.value);

export const RECIPE_CATEGORY_LABELS: Record<string, { label: string; icon: string }> = Object.fromEntries(
  RECIPE_CATEGORIES.map((c) => [c.value, { label: c.label, icon: c.icon }])
);
