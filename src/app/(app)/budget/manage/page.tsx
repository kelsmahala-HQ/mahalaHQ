import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireAdult } from "@/lib/household";
import { Card, EmptyState, PageHeader, iconButtonClass, inputClass } from "@/components/ui";
import { deleteBill, updateBill } from "../actions";
import AddBillForm from "../add-bill-form";

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

export default async function ManageBillsPage() {
  const household = await requireAdult();
  const supabase = await createClient();

  const { data: bills } = await supabase
    .from("bills")
    .select("*")
    .eq("household_id", household.householdId)
    .order("due_date");

  return (
    <div>
      <PageHeader
        title="Manage Bills"
        subtitle="This is your template — edit it once and every week/month in Budget is generated from it automatically."
      />

      <Link href="/budget" className="mb-6 inline-block text-sm text-teal-600 hover:underline">
        ← Back to this week
      </Link>

      <Card className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Add a bill</h2>
        <AddBillForm todayStr={format(new Date(), "yyyy-MM-dd")} />
      </Card>

      <h2 className="mb-3 text-sm font-semibold text-slate-700">All bills</h2>
      {!bills?.length ? (
        <EmptyState message="No bills set up yet — add one above." />
      ) : (
        <div className="space-y-2">
          {bills.map((b) => (
            <Card key={b.id} className="!p-4">
              <form action={updateBill} className="flex flex-wrap items-center justify-between gap-2">
                <input type="hidden" name="id" value={b.id} />
                <input name="name" defaultValue={b.name} className={`${inputClass} w-40 !py-1 text-sm font-medium`} />
                <select name="category" defaultValue={b.category} className={`${inputClass} w-32 !py-1 text-sm`}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input name="amount" type="number" step="0.01" defaultValue={b.amount} className={`${inputClass} w-24 !py-1 text-sm`} />
                <input
                  name="assigned_to"
                  defaultValue={b.assigned_to ?? ""}
                  placeholder="Who"
                  className={`${inputClass} w-28 !py-1 text-sm`}
                />
                <select name="frequency" defaultValue={b.frequency} className={`${inputClass} w-32 !py-1 text-sm`}>
                  {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Due date</label>
                  <input name="due_date" type="date" defaultValue={b.due_date} className={`${inputClass} w-40 !py-1 text-sm`} />
                </div>
                <div className="ml-auto flex gap-2">
                  <button type="submit" className="rounded-lg bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100">
                    Save
                  </button>
                </div>
              </form>
              <form action={deleteBill} className="mt-1">
                <input type="hidden" name="id" value={b.id} />
                <button className={iconButtonClass}>Remove</button>
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
