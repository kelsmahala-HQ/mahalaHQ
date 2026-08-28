"use client";

import { useState } from "react";
import { Card, buttonClass, inputClass } from "@/components/ui";
import { GROCERY_CATEGORIES } from "@/lib/grocery-categories";
import { quantityMultiplier } from "@/lib/quantity";
import { deleteItem, toggleItem, updateItem } from "./actions";

type Item = {
  id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  price: number | null;
  is_checked: boolean;
};

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function GroceryItemRow({ item }: { item: Item }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);

    const result = await updateItem(new FormData(form));

    setLoading(false);
    if ("error" in result) setError(result.error);
    else setEditing(false);
  }

  if (editing) {
    return (
      <Card className="!p-3">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_90px_100px_130px_auto_auto] sm:items-center">
          <input type="hidden" name="id" value={item.id} />
          <input name="name" required defaultValue={item.name} placeholder="Item" className={inputClass} />
          <input name="quantity" defaultValue={item.quantity ?? ""} placeholder="Qty" className={inputClass} />
          <input
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={item.price ?? ""}
            placeholder="Price ea"
            title="Price per item -- multiplied by the number in Qty for the total"
            className={inputClass}
          />
          <select name="category" defaultValue={item.category ?? "other"} className={inputClass}>
            {GROCERY_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Saving..." : "Save"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-sm text-slate-500 hover:text-slate-700">
            Cancel
          </button>
        </form>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </Card>
    );
  }

  return (
    <Card className="flex items-center justify-between !p-3">
      <form action={toggleItem} className="flex flex-1 items-center gap-3">
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="isChecked" value={String(item.is_checked)} />
        <button
          type="submit"
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
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
      <div className="flex shrink-0 items-center gap-3">
        {item.price != null && (() => {
          const multiplier = quantityMultiplier(item.quantity);
          return (
            <span className="text-sm font-medium text-slate-500">
              {currency(item.price * multiplier)}
              {multiplier !== 1 && <span className="ml-1 text-xs font-normal text-slate-400">({currency(item.price)} ea)</span>}
            </span>
          );
        })()}
        <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-teal-600 hover:text-teal-500">
          Edit
        </button>
        <form action={deleteItem}>
          <input type="hidden" name="id" value={item.id} />
          <button className="text-xs text-slate-400 hover:text-red-600">Remove</button>
        </form>
      </div>
    </Card>
  );
}
