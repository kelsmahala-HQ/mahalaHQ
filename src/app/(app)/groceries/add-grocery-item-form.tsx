"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { GROCERY_CATEGORIES } from "@/lib/grocery-categories";
import { addItem, getRememberedPrice } from "./actions";

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

type PriceHistoryEntry = { display_name: string; last_price: number };

export default function AddGroceryItemForm({ priceHistory }: { priceHistory: PriceHistoryEntry[] }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);

  const query = name.trim().toLowerCase();
  const matches =
    query.length >= 2 ? priceHistory.filter((p) => p.display_name.toLowerCase().includes(query)).slice(0, 5) : [];

  function pickSuggestion(entry: PriceHistoryEntry) {
    setName(entry.display_name);
    setPrice(String(entry.last_price));
    setShowSuggestions(false);
  }

  async function handleNameBlur() {
    // Give a click on a suggestion a moment to register before the list disappears.
    setTimeout(() => setShowSuggestions(false), 150);
    const trimmed = name.trim();
    if (!trimmed || price) return; // don't clobber a price already picked/typed
    const remembered = await getRememberedPrice(trimmed);
    if (remembered !== null) setPrice(String(remembered));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    await addItem(new FormData(form));
    setLoading(false);
    form.reset();
    setName("");
    setPrice("");
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_90px_110px_170px_auto]">
      <div className="relative">
        <input
          name="name"
          required
          placeholder="Item (e.g. Milk)"
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={handleNameBlur}
          className={inputClass}
        />
        {showSuggestions && !!matches.length && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {matches.map((m) => (
              <button
                key={m.display_name}
                type="button"
                onMouseDown={(e) => e.preventDefault()} // keep the blur from firing before the click
                onClick={() => pickSuggestion(m)}
                className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-teal-50"
              >
                <span className="text-slate-800">{m.display_name}</span>
                <span className="text-slate-400">{currency(m.last_price)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <input name="quantity" placeholder="Qty" className={inputClass} />
      <input
        name="price"
        type="number"
        step="0.01"
        min="0"
        placeholder="Price ea"
        title="Price per item -- multiplied by the number in Qty for the total"
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
