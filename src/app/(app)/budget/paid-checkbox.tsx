"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

type Props = {
  billId: string;
  name: string;
  category: string;
  amount: number;
  naturalDueDate: string; // yyyy-MM-dd, the true recurrence-math due date (reschedule key)
  weekStart: string; // yyyy-MM-dd, the period currently being viewed
  isIncome: boolean;
  moved: boolean;
  paid: { id: string; amount: number } | null;
  markBillPaid: (formData: FormData) => Promise<void>;
  deleteBillPayment: (formData: FormData) => Promise<void>;
  rescheduleBillOccurrence: (formData: FormData) => Promise<void>;
  undoReschedule: (formData: FormData) => Promise<void>;
};

export default function PaidCheckbox({
  billId,
  name,
  category,
  amount,
  naturalDueDate,
  weekStart,
  isIncome,
  moved,
  paid,
  markBillPaid,
  deleteBillPayment,
  rescheduleBillOccurrence,
  undoReschedule,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [displayAmount, setDisplayAmount] = useState(paid?.amount ?? amount);
  const [editingAmount, setEditingAmount] = useState(false);
  const [editingDate, setEditingDate] = useState(false);

  function togglePaid() {
    startTransition(async () => {
      if (paid) {
        const fd = new FormData();
        fd.set("id", paid.id);
        await deleteBillPayment(fd);
      } else {
        const fd = new FormData();
        fd.set("bill_id", billId);
        fd.set("amount", String(displayAmount));
        fd.set("paid_on", weekStart);
        await markBillPaid(fd);
      }
    });
  }

  function commitAmount(value: number) {
    if (isNaN(value) || value < 0) value = paid?.amount ?? amount;
    setDisplayAmount(value);
    setEditingAmount(false);
    if (paid) {
      // Already paid -- swap the payment record for one with the corrected amount.
      startTransition(async () => {
        const del = new FormData();
        del.set("id", paid.id);
        await deleteBillPayment(del);
        const ins = new FormData();
        ins.set("bill_id", billId);
        ins.set("amount", String(value));
        ins.set("paid_on", weekStart);
        await markBillPaid(ins);
      });
    }
  }

  function commitMove(targetDate: string) {
    // Native date inputs fire onChange per keystroke/segment while typing, with an empty value
    // until all of month/day/year are filled in -- only close and submit once it's complete.
    if (!targetDate) return;
    setEditingDate(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("bill_id", billId);
      fd.set("original_due_date", naturalDueDate);
      fd.set("target_date", targetDate);
      await rescheduleBillOccurrence(fd);
    });
  }

  function undo() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("bill_id", billId);
      fd.set("original_due_date", naturalDueDate);
      await undoReschedule(fd);
    });
  }

  return (
    <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 hover:border-teal-200">
      <input
        type="checkbox"
        checked={!!paid}
        disabled={pending}
        onChange={togglePaid}
        className="h-5 w-5 shrink-0 cursor-pointer accent-teal-600"
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${paid ? "text-slate-400 line-through" : "text-slate-900"}`}>
          {name}
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-normal text-slate-500">
            {category}
          </span>
          {moved && (
            <span className="ml-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-800">
              moved
            </span>
          )}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
          <span>due {format(new Date(`${naturalDueDate}T00:00:00`), "MMM d")}</span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setEditingDate((v) => !v);
            }}
            className="font-medium text-teal-600 hover:text-teal-500"
          >
            move week
          </button>
          {moved && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                undo();
              }}
              className="font-medium text-slate-400 hover:text-red-600"
            >
              undo
            </button>
          )}
        </div>
        {editingDate && (
          <div className="mt-1 flex items-center gap-2">
            <input
              type="date"
              autoFocus
              className="rounded-md border border-teal-500 px-2 py-1 text-xs"
              onChange={(e) => commitMove(e.target.value)}
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setEditingDate(false);
              }}
              className="text-xs text-slate-400 hover:text-red-600"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {editingAmount ? (
          <input
            type="number"
            step="0.01"
            autoFocus
            defaultValue={displayAmount}
            className="w-20 rounded-md border border-teal-500 px-2 py-1 text-right text-sm font-semibold"
            onClick={(e) => e.preventDefault()}
            onBlur={(e) => commitAmount(Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditingAmount(false);
            }}
          />
        ) : (
          <span className={`text-sm font-semibold ${isIncome ? "text-teal-700" : "text-slate-900"}`}>
            {currency(displayAmount)}
          </span>
        )}
        <button
          type="button"
          title="Edit amount"
          onClick={(e) => {
            e.preventDefault();
            setEditingAmount((v) => !v);
          }}
          className="rounded px-1 py-0.5 text-xs opacity-50 hover:bg-slate-100 hover:opacity-100"
        >
          ✏️
        </button>
      </div>
    </label>
  );
}
