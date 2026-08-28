"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { GROCERY_CATEGORIES } from "@/lib/grocery-categories";
import { addItem, getRememberedPrice } from "./actions";

export default function AddGroceryItemForm() {
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleNameBlur(e: React.FocusEvent<HTMLInputElement>) {
    const name = e.target.value.trim();
    if (!name || price) return; // don't clobber a price she's already typed in
    const remembered = await getRememberedPrice(name);
    if (remembered !== null) setPrice(String(remembered));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    await addItem(new FormData(form));
    setLoading(false);
    form.reset();
    setPrice("");
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_90px_110px_170px_auto]">
      <input name="name" required placeholder="Item (e.g. Milk)" onBlur={handleNameBlur} className={inputClass} />
      <input name="quantity" placeholder="Qty" className={inputClass} />
      <input
        name="price"
        type="number"
        step="0.01"
        min="0"
        placeholder="Price"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className={inputClass}
      />
      <select name="category" defaultValue="other" className={inputClass}>
        {GROCERY_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.icon} {c.label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={loading} className={buttonClass}>
        {loading ? "Adding..." : "Add"}
      </button>
    </form>
  );
}
