"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { addDebt } from "./actions";

export default function AddDebtForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);

    const result = await addDebt(new FormData(form));

    setLoading(false);
    if ("error" in result) setError(result.error);
    else form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input name="name" required placeholder="Name (e.g. Chase Visa)" className={inputClass} />
      <input name="creditor" placeholder="Creditor" className={inputClass} />
      <input name="current_balance" type="number" step="0.01" required placeholder="Current balance" className={inputClass} />
      <input name="interest_rate" type="number" step="0.01" placeholder="Interest rate %" className={inputClass} />
      <input name="minimum_payment" type="number" step="0.01" placeholder="Minimum payment" className={inputClass} />
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Payment frequency</label>
        <select name="payment_frequency" defaultValue="monthly" className={inputClass}>
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">If monthly: due day (1–31)</label>
        <input name="due_day" type="number" min={1} max={31} placeholder="e.g. 15" className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-500">If weekly: due day of week</label>
        <select name="due_weekday" defaultValue="" className={inputClass}>
          <option value="">—</option>
          <option value="0">Sunday</option>
          <option value="1">Monday</option>
          <option value="2">Tuesday</option>
          <option value="3">Wednesday</option>
          <option value="4">Thursday</option>
          <option value="5">Friday</option>
          <option value="6">Saturday</option>
        </select>
      </div>
      <p className="text-xs text-slate-400 sm:col-span-2">
        Add a minimum payment and a due day/weekday to have this automatically show up in Budget.
      </p>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <button type="submit" disabled={loading} className={`${buttonClass} sm:col-span-2`}>
        {loading ? "Adding..." : "Add debt"}
      </button>
    </form>
  );
}
