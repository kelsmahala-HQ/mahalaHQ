"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { addBill } from "./actions";

const CATEGORIES = [
  "Income",
  "Personal",
  "Utility",
  "House",
  "Credit Card",
  "Groceries",
  "Transportation",
  "Loan",
  "Savings",
  "Child Support",
  "Subscriptions",
  "Sinking Fund",
  "Other",
];

const FREQUENCY_LABELS: Record<string, string> = {
  once: "One-time",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semiannual: "Every 6 months",
  yearly: "Yearly",
};

export default function AddBillForm({ todayStr }: { todayStr: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await addBill(new FormData(e.currentTarget));

    setLoading(false);
    if ("error" in result) setError(result.error);
    else e.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input name="name" required placeholder="Name (e.g. Electric, Kelsey's Paycheck)" className={`${inputClass} sm:col-span-2`} />
      <select name="type" defaultValue="expense" className={inputClass}>
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      </select>
      <select name="category" defaultValue="Other" className={inputClass}>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input name="amount" type="number" step="0.01" required placeholder="Amount" className={inputClass} />
      <select name="frequency" defaultValue="monthly" className={inputClass}>
        {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Due date (first/next occurrence)</label>
        <input name="due_date" type="date" required defaultValue={todayStr} className={inputClass} />
      </div>
      <input name="assigned_to" placeholder="Who (optional)" className={inputClass} />
      <input name="notes" placeholder="Notes (optional)" className={`${inputClass} sm:col-span-2`} />
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <button type="submit" disabled={loading} className={`${buttonClass} sm:col-span-2`}>
        {loading ? "Adding..." : "Add bill"}
      </button>
    </form>
  );
}
