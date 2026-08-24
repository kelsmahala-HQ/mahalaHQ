"use client";

import { useState } from "react";
import { Card, buttonClass, iconButtonClass, inputClass } from "@/components/ui";
import { deleteDebt, logPayment, setFocusDebt, updateDebt } from "./actions";
import SyncToBudgetButton from "./sync-to-budget-button";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

type Debt = {
  id: string;
  name: string;
  creditor: string | null;
  original_balance: number | null;
  current_balance: number;
  interest_rate: number | null;
  minimum_payment: number | null;
  payment_frequency: string;
  due_day: number | null;
  due_weekday: number | null;
  is_focus: boolean;
};

export default function DebtRow({ debt: d, inBudget }: { debt: Debt; inBudget: boolean }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSync = !!d.minimum_payment && (!!d.due_day || d.due_weekday !== null);
  const original = Number(d.original_balance ?? d.current_balance);
  const current = Number(d.current_balance);
  const paidPct = original > 0 ? Math.min(100, Math.round(((original - current) / original) * 100)) : 0;

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);

    const result = await updateDebt(new FormData(form));

    setLoading(false);
    if ("error" in result) setError(result.error);
    else setEditing(false);
  }

  if (editing) {
    return (
      <Card className={d.is_focus ? "ring-2 ring-yellow-400" : ""}>
        <form onSubmit={handleEditSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={d.id} />
          <input name="name" required defaultValue={d.name} placeholder="Name" className={`${inputClass} sm:col-span-2`} />
          <input name="creditor" defaultValue={d.creditor ?? ""} placeholder="Creditor" className={inputClass} />
          <input name="interest_rate" type="number" step="0.01" defaultValue={d.interest_rate ?? ""} placeholder="Interest rate %" className={inputClass} />
          <input
            name="minimum_payment"
            type="number"
            step="0.01"
            defaultValue={d.minimum_payment ?? ""}
            placeholder="Minimum payment"
            className={inputClass}
          />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Payment frequency</label>
            <select name="payment_frequency" defaultValue={d.payment_frequency} className={inputClass}>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">If monthly: due day (1–31)</label>
            <input name="due_day" type="number" min={1} max={31} defaultValue={d.due_day ?? ""} placeholder="e.g. 15" className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">If weekly: due day of week</label>
            <select name="due_weekday" defaultValue={d.due_weekday ?? ""} className={inputClass}>
              <option value="">—</option>
              {WEEKDAY_NAMES.map((name, i) => (
                <option key={i} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={loading} className={buttonClass}>
              {loading ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-slate-500 hover:text-slate-700">
              Cancel
            </button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className={d.is_focus ? "ring-2 ring-yellow-400" : ""}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <form action={setFocusDebt}>
            <input type="hidden" name="id" value={d.id} />
            <button
              type="submit"
              title={d.is_focus ? "Current focus debt" : "Make this the focus debt"}
              className={`text-lg ${d.is_focus ? "" : "opacity-30 hover:opacity-70"}`}
            >
              ⭐
            </button>
          </form>
          <div>
            <p className="font-medium text-slate-900">{d.name}</p>
            <p className="text-sm text-slate-500">
              {[
                d.creditor,
                d.interest_rate ? `${d.interest_rate}% APR` : null,
                d.minimum_payment ? `min ${currency(Number(d.minimum_payment))}` : null,
                d.payment_frequency === "weekly" && d.due_weekday !== null
                  ? `due ${WEEKDAY_NAMES[d.due_weekday]}s`
                  : d.due_day
                    ? `due day ${d.due_day}`
                    : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {inBudget ? (
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">✓ In Budget</span>
          ) : canSync ? (
            <SyncToBudgetButton debtId={d.id} />
          ) : null}
          <button onClick={() => setEditing(true)} className="text-xs font-medium text-teal-600 hover:text-teal-500">
            Edit
          </button>
          <form action={deleteDebt}>
            <input type="hidden" name="id" value={d.id} />
            <button className={iconButtonClass}>Remove</button>
          </form>
        </div>
      </div>

      {!inBudget && !canSync && (
        <p className="mb-2 text-xs text-amber-600">
          Not in Budget yet — click Edit to add a minimum payment and a due day/weekday, then sync it as a bill.
        </p>
      )}

      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-900">{currency(current)} remaining</span>
        <span className="text-slate-400">{paidPct}% paid off</span>
      </div>
      <div className="mb-4 h-2 w-full rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-teal-500" style={{ width: `${paidPct}%` }} />
      </div>

      <form action={logPayment} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="debt_id" value={d.id} />
        <input name="amount" type="number" step="0.01" required placeholder="Payment amount" className={`${inputClass} w-40`} />
        <input name="paid_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={`${inputClass} w-40`} />
        <input name="note" placeholder="Note (optional)" className={`${inputClass} w-48`} />
        <button type="submit" className="rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100">
          Log payment
        </button>
      </form>
    </Card>
  );
}
