"use client";

import { useState } from "react";
import { Card, buttonClass, iconButtonClass, inputClass } from "@/components/ui";

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

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

type Bill = {
  id: string;
  name: string;
  type: string;
  category: string;
  amount: number;
  frequency: string;
  due_date: string;
  assigned_to: string | null;
  debt_id: string | null;
};

export default function BillRow({
  bill,
  updateBill,
  deleteBill,
}: {
  bill: Bill;
  updateBill: (formData: FormData) => void;
  deleteBill: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <Card className="flex items-center justify-between gap-3 !p-4">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">
            {bill.name}
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
              {bill.category}
            </span>
            {bill.debt_id && (
              <span className="ml-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-normal text-teal-700">
                🔗 from Debts
              </span>
            )}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            {FREQUENCY_LABELS[bill.frequency]} · due {bill.due_date}
            {bill.assigned_to ? ` · ${bill.assigned_to}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={`text-sm font-semibold ${bill.type === "income" ? "text-teal-600" : "text-slate-900"}`}>
            {currency(Number(bill.amount))}
          </span>
          <button onClick={() => setEditing(true)} className="text-xs font-medium text-teal-600 hover:text-teal-500">
            Edit
          </button>
          <form action={deleteBill}>
            <input type="hidden" name="id" value={bill.id} />
            <button className={iconButtonClass}>Remove</button>
          </form>
        </div>
      </Card>
    );
  }

  return (
    <Card className="!p-4">
      <form
        action={(formData) => {
          updateBill(formData);
          setEditing(false);
        }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <input type="hidden" name="id" value={bill.id} />
        <input name="name" defaultValue={bill.name} placeholder="Name" className={`${inputClass} sm:col-span-2`} />
        <select name="category" defaultValue={bill.category} className={inputClass}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input name="amount" type="number" step="0.01" defaultValue={bill.amount} className={inputClass} />
        <select name="frequency" defaultValue={bill.frequency} className={inputClass}>
          {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Due date</label>
          <input name="due_date" type="date" defaultValue={bill.due_date} className={inputClass} />
        </div>
        <input name="assigned_to" defaultValue={bill.assigned_to ?? ""} placeholder="Who (optional)" className={`${inputClass} sm:col-span-2`} />
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className={buttonClass}>
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-sm text-slate-500 hover:text-slate-700">
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
