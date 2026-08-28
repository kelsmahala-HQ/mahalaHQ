import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { GROCERY_CATEGORIES, GROCERY_CATEGORY_LABELS } from "@/lib/grocery-categories";
import { quantityMultiplier } from "@/lib/quantity";
import { clearChecked } from "./actions";
import AddGroceryItemForm from "./add-grocery-item-form";
import GroceryItemRow from "./grocery-item-row";

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function GroceriesPage() {
  const household = await requireHousehold();
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("grocery_items")
    .select("*")
    .eq("household_id", household.householdId)
    .order("is_checked")
    .order("created_at", { ascending: false });

  const hasChecked = items?.some((i) => i.is_checked);

  const knownCategories = new Set(GROCERY_CATEGORIES.map((c) => c.value));
  const itemsByCategory = new Map<string, NonNullable<typeof items>>();
  for (const item of items ?? []) {
    const key = knownCategories.has(item.category) ? item.category : "other";
    if (!itemsByCategory.has(key)) itemsByCategory.set(key, []);
    itemsByCategory.get(key)!.push(item);
  }
  const orderedCategoryKeys = GROCERY_CATEGORIES.map((c) => c.value);

  const priced = (items ?? []).filter((i) => i.price != null);
  const total = priced.reduce((sum, i) => sum + Number(i.price) * quantityMultiplier(i.quantity), 0);
  const uncounted = (items?.length ?? 0) - priced.length;

  return (
    <div>
      <PageHeader title="Grocery List" subtitle="Shared list — anyone in the household can add or check items." />

      <Card className="mb-6">
        <AddGroceryItemForm />
      </Card>

      {!!items?.length && (
        <Card className="mb-8 !bg-yellow-50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Estimated total</p>
            <p className="text-xl font-semibold text-slate-900">{currency(total)}</p>
          </div>
          {uncounted > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {uncounted} item{uncounted === 1 ? "" : "s"} without a price yet aren&rsquo;t counted — add one and it&rsquo;s remembered for next time.
            </p>
          )}
        </Card>
      )}

      {!items?.length ? (
        <EmptyState message="Grocery list is empty." />
      ) : (
        <>
          <div className="space-y-6">
            {orderedCategoryKeys.map((key) => {
              const inCategory = itemsByCategory.get(key);
              if (!inCategory?.length) return null;
              const info = GROCERY_CATEGORY_LABELS[key];
              return (
                <div key={key}>
                  <h2 className="mb-2 text-sm font-semibold text-slate-700">
                    {info.icon} {info.label}
                  </h2>
                  <div className="space-y-2">
                    {inCategory.map((item) => (
                      <GroceryItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {hasChecked && (
            <form action={clearChecked} className="mt-4">
              <button className="text-sm text-slate-500 hover:text-red-600">Clear checked items</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
