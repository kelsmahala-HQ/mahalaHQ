import { addMonths, addWeeks, addYears, endOfWeek, format, startOfWeek } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireAdult } from "@/lib/household";
import { Card, EmptyState, PageHeader, buttonClass, iconButtonClass, inputClass } from "@/components/ui";
import { addBill, deleteBill, deleteBillPayment, markBillPaid, updateBill } from "./actions";

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

// Pay periods run Saturday -> Friday, so a period starts the day after payday and ends on the next one.
const PAY_PERIOD_OPTS = { weekStartsOn: 6 as const };

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function advance(date: Date, frequency: string): Date {
  switch (frequency) {
    case "weekly":
      return addWeeks(date, 1);
    case "biweekly":
      return addWeeks(date, 2);
    case "monthly":
      return addMonths(date, 1);
    case "quarterly":
      return addMonths(date, 3);
    case "semiannual":
      return addMonths(date, 6);
    case "yearly":
      return addYears(date, 1);
    default:
      return date; // 'once'
  }
}

/** Finds the single occurrence date of this bill that lands within [periodStart, periodEnd], if any. */
function occurrenceInPeriod(bill: { due_date: string; frequency: string }, periodStart: Date, periodEnd: Date): Date | null {
  if (bill.frequency === "once") {
    const d = new Date(`${bill.due_date}T00:00:00`);
    return d >= periodStart && d <= periodEnd ? d : null;
  }
  let occurrence = new Date(`${bill.due_date}T00:00:00`);
  let guard = 0;
  while (occurrence <= periodEnd && guard < 500) {
    if (occurrence >= periodStart) return occurrence;
    occurrence = advance(occurrence, bill.frequency);
    guard++;
  }
  return null;
}

export default async function BudgetPage() {
  const household = await requireAdult();
  const supabase = await createClient();

  const now = new Date();
  const periodStartDate = startOfWeek(now, PAY_PERIOD_OPTS);
  const periodEndDate = endOfWeek(now, PAY_PERIOD_OPTS);
  const periodStart = format(periodStartDate, "yyyy-MM-dd");
  const periodEnd = format(periodEndDate, "yyyy-MM-dd");

  const [{ data: bills }, { data: payments }] = await Promise.all([
    supabase.from("bills").select("*").eq("household_id", household.householdId).order("due_date"),
    supabase
      .from("bill_payments")
      .select("*")
      .eq("household_id", household.householdId)
      .gte("paid_on", periodStart)
      .lte("paid_on", periodEnd),
  ]);

  const paidByBill = new Map<string, { id: string; amount: number; paid_on: string }>();
  for (const p of payments ?? []) paidByBill.set(p.bill_id, { id: p.id, amount: Number(p.amount), paid_on: p.paid_on });

  const billsThisPeriod = (bills ?? [])
    .map((b) => ({ ...b, occurrence: occurrenceInPeriod(b, periodStartDate, periodEndDate) }))
    .filter((b) => b.occurrence !== null)
    .sort((a, b) => a.occurrence!.getTime() - b.occurrence!.getTime());

  let totalIncome = 0;
  let totalExpense = 0;
  let plannedIncome = 0;
  let plannedExpense = 0;
  for (const b of billsThisPeriod) {
    const paid = paidByBill.get(b.id);
    if (b.type === "income") {
      plannedIncome += Number(b.amount);
      if (paid) totalIncome += paid.amount;
    } else {
      plannedExpense += Number(b.amount);
      if (paid) totalExpense += paid.amount;
    }
  }
  const unallocated = plannedIncome - plannedExpense;

  return (
    <div>
      <PageHeader
        title="Budget"
        subtitle={`This pay period: ${format(periodStartDate, "MMM d")} – ${format(periodEndDate, "MMM d, yyyy")} (Sat–Fri, aligned to payday)`}
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase text-slate-400">Income</p>
          <p className="mt-1 text-2xl font-semibold text-teal-600">{currency(totalIncome)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-slate-400">Expenses</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{currency(totalExpense)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-slate-400">Net</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{currency(totalIncome - totalExpense)}</p>
        </Card>
        <Card className={unallocated < 0 ? "!bg-red-50" : "!bg-yellow-50"}>
          <p className="text-xs font-medium uppercase text-slate-400">Unallocated</p>
          <p className={`mt-1 text-2xl font-semibold ${unallocated < 0 ? "text-red-600" : "text-slate-900"}`}>
            {currency(unallocated)}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">Planned income minus planned bills, this period</p>
        </Card>
      </div>

      <Card className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Add a bill</h2>
        <form action={addBill} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <input name="due_date" type="date" required defaultValue={format(now, "yyyy-MM-dd")} className={inputClass} />
          </div>
          <input name="assigned_to" placeholder="Who (optional)" className={inputClass} />
          <input name="notes" placeholder="Notes (optional)" className={`${inputClass} sm:col-span-2`} />
          <button type="submit" className={`${buttonClass} sm:col-span-2`}>
            Add bill
          </button>
        </form>
      </Card>

      <h2 className="mb-3 text-sm font-semibold text-slate-700">This period</h2>
      {!billsThisPeriod.length ? (
        <EmptyState message="No bills due this pay period." />
      ) : (
        <div className="mb-8 space-y-2">
          {billsThisPeriod.map((b) => {
            const paid = paidByBill.get(b.id);
            return (
              <Card key={b.id} className="flex flex-wrap items-center justify-between gap-2 !p-4">
                <div>
                  <p className="font-medium text-slate-900">
                    {b.name}{" "}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">{b.category}</span>
                  </p>
                  <p className="text-sm text-slate-500">
                    {currency(Number(b.amount))} · due {format(b.occurrence!, "MMM d")}
                    {b.assigned_to ? ` · ${b.assigned_to}` : ""}
                  </p>
                </div>
                {paid ? (
                  <form action={deleteBillPayment} className="flex items-center gap-2">
                    <span className="rounded-full bg-teal-100 px-2 py-1 text-xs font-medium text-teal-800">
                      ✅ Paid {currency(paid.amount)} on {paid.paid_on}
                    </span>
                    <input type="hidden" name="id" value={paid.id} />
                    <button className="text-xs text-slate-400 hover:text-red-600">Undo</button>
                  </form>
                ) : (
                  <form action={markBillPaid} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="bill_id" value={b.id} />
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      defaultValue={b.amount}
                      className={`${inputClass} w-24 !py-1 text-sm`}
                    />
                    <input
                      name="paid_on"
                      type="date"
                      defaultValue={format(b.occurrence!, "yyyy-MM-dd")}
                      className={`${inputClass} w-40 !py-1 text-sm`}
                    />
                    <button type="submit" className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100">
                      Mark {b.type === "income" ? "Received" : "Paid"}
                    </button>
                  </form>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold text-slate-700">All bills</h2>
      {!bills?.length ? (
        <EmptyState message="No bills set up yet — add one above." />
      ) : (
        <div className="space-y-2">
          {bills.map((b) => (
            <Card key={b.id} className="!p-4">
              <form action={updateBill} className="flex flex-wrap items-center justify-between gap-2">
                <input type="hidden" name="id" value={b.id} />
                <input
                  name="name"
                  defaultValue={b.name}
                  className={`${inputClass} w-40 !py-1 text-sm font-medium`}
                />
                <select name="category" defaultValue={b.category} className={`${inputClass} w-32 !py-1 text-sm`}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  defaultValue={b.amount}
                  className={`${inputClass} w-24 !py-1 text-sm`}
                />
                <input
                  name="assigned_to"
                  defaultValue={b.assigned_to ?? ""}
                  placeholder="Who"
                  className={`${inputClass} w-28 !py-1 text-sm`}
                />
                <span className="text-xs text-slate-400">
                  {FREQUENCY_LABELS[b.frequency]} · anchor {b.due_date}
                </span>
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
