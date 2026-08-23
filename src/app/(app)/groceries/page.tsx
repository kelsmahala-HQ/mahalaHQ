import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { addItem, clearChecked, deleteItem, toggleItem } from "./actions";

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

  return (
    <div>
      <PageHeader title="Grocery List" subtitle="Shared list — anyone in the household can add or check items." />

      <Card className="mb-8">
        <form action={addItem} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_140px_auto]">
          <input name="name" required placeholder="Item (e.g. Milk)" className={inputClass} />
          <input name="quantity" placeholder="Qty" className={inputClass} />
          <input name="category" placeholder="Category" className={inputClass} />
          <button type="submit" className={buttonClass}>
            Add
          </button>
        </form>
      </Card>

      {!items?.length ? (
        <EmptyState message="Grocery list is empty." />
      ) : (
        <>
          <div className="space-y-2">
            {items.map((item) => (
              <Card key={item.id} className="flex items-center justify-between !p-3">
                <form action={toggleItem} className="flex flex-1 items-center gap-3">
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="isChecked" value={String(item.is_checked)} />
                  <button
                    type="submit"
                    className={`flex h-5 w-5 items-center justify-center rounded border ${
                      item.is_checked ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300"
                    }`}
                  >
                    {item.is_checked && "✓"}
                  </button>
                  <span className={`text-sm ${item.is_checked ? "text-slate-400 line-through" : "text-slate-900"}`}>
                    {item.name}
                    {item.quantity && <span className="text-slate-400"> · {item.quantity}</span>}
                  </span>
                </form>
                <form action={deleteItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="text-xs text-slate-400 hover:text-red-600">Remove</button>
                </form>
              </Card>
            ))}
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
