import Link from "next/link";
import { addWeeks, endOfWeek, format, startOfWeek, subWeeks } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireAdult } from "@/lib/household";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { PAY_PERIOD_OPTS, applyReschedules, occurrenceInPeriod } from "@/lib/pay-period";
import { markBillPaid, deleteBillPayment, rescheduleBillOccurrence, undoReschedule } from "./actions";
import PaidCheckbox from "./paid-checkbox";

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const household = await requireAdult();
  const supabase = await createClient();
  const { week } = await searchParams;

  const anchor = week ? new Date(`${week}T00:00:00`) : new Date();
  const periodStartDate = startOfWeek(anchor, PAY_PERIOD_OPTS);
  const periodEndDate = endOfWeek(anchor, PAY_PERIOD_OPTS);
  const periodStart = format(periodStartDate, "yyyy-MM-dd");
  const periodEnd = format(periodEndDate, "yyyy-MM-dd");
  const isCurrentWeek = periodStart === format(startOfWeek(new Date(), PAY_PERIOD_OPTS), "yyyy-MM-dd");

  const [{ data: bills }, { data: payments }, { data: reschedules }] = await Promise.all([
    supabase.from("bills").select("*").eq("household_id", household.householdId).order("due_date"),
    supabase
      .from("bill_payments")
      .select("*")
      .eq("household_id", household.householdId)
      .gte("paid_on", periodStart)
      .lte("paid_on", periodEnd),
    supabase.from("bill_reschedules").select("*").eq("household_id", household.householdId),
  ]);

  const paidByBill = new Map<string, { id: string; amount: number }>();
  for (const p of payments ?? []) paidByBill.set(p.bill_id, { id: p.id, amount: Number(p.amount) });

  const naturalThisPeriod = (bills ?? [])
    .map((b) => ({ ...b, occurrence: occurrenceInPeriod(b, periodStartDate, periodEndDate) }))
    .filter((b): b is typeof b & { occurrence: Date } => b.occurrence !== null);

  const billsThisPeriod = applyReschedules(bills ?? [], naturalThisPeriod, reschedules ?? [], periodStartDate).sort(
    (a, b) => a.occurrence.getTime() - b.occurrence.getTime()
  );

  const incomeBills = billsThisPeriod.filter((b) => b.type === "income");
  const expenseBills = billsThisPeriod.filter((b) => b.type === "expense");

  // Everything due this week counts toward the total whether it's checked off yet or not, but
  // once something's actually paid, its real amount (which may differ from the bill's usual
  // amount) replaces the estimate.
  const totalIncome = incomeBills.reduce((sum, b) => sum + (paidByBill.get(b.id)?.amount ?? Number(b.amount)), 0);
  const totalExpense = expenseBills.reduce((sum, b) => sum + (paidByBill.get(b.id)?.amount ?? Number(b.amount)), 0);
  const remaining = totalIncome - totalExpense;

  const prevWeek = format(subWeeks(periodStartDate, 1), "yyyy-MM-dd");
  const nextWeek = format(addWeeks(periodStartDate, 1), "yyyy-MM-dd");

  return (
    <div>
      <PageHeader title="Budget" subtitle="Fri–Thu pay periods, funded by that Friday's paycheck." />

      <Card className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <Link href={`/budget?week=${prevWeek}`} className="text-sm font-semibold text-slate-500 hover:text-teal-600">
            ← Prev week
          </Link>
          <h2 className="text-base font-bold text-slate-900">
            {format(periodStartDate, "MMM d")} – {format(periodEndDate, "MMM d, yyyy")}
          </h2>
          <Link href={`/budget?week=${nextWeek}`} className="text-sm font-semibold text-slate-500 hover:text-teal-600">
            Next week →
          </Link>
        </div>
        <div className="flex gap-4 text-sm">
          <Link href="/budget/month" className="font-semibold text-teal-600 hover:underline">
            View month →
          </Link>
          <Link href="/budget/manage" className="font-semibold text-teal-600 hover:underline">
            Manage bills →
          </Link>
        </div>
      </Card>

      <div className="mb-1 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase text-slate-400">Income</p>
          <p className="mt-1 text-2xl font-semibold text-teal-600">{currency(totalIncome)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-slate-400">Expenses</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{currency(totalExpense)}</p>
        </Card>
        <Card className={remaining < 0 ? "!bg-red-50" : "!bg-yellow-50"}>
          <p className="text-xs font-medium uppercase text-slate-400">Remaining</p>
          <p className={`mt-1 text-2xl font-semibold ${remaining < 0 ? "text-red-600" : "text-slate-900"}`}>
            {currency(remaining)}
          </p>
        </Card>
      </div>
      <p className="mb-6 text-xs text-slate-400">Everything due this week, whether it&rsquo;s checked off yet or not.</p>

      <Card>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Income</h2>
        {!incomeBills.length ? (
          <EmptyState message="No income due this week." />
        ) : (
          <div className="space-y-2">
            {incomeBills.map((b) => (
              <PaidCheckbox
                key={b.id}
                billId={b.id}
                name={b.name}
                category={b.category}
                amount={Number(b.amount)}
                naturalDueDate={format(b.occurrence, "yyyy-MM-dd")}
                weekStart={periodStart}
                isIncome
                moved={b.moved}
                paid={paidByBill.get(b.id) ?? null}
                markBillPaid={markBillPaid}
                deleteBillPayment={deleteBillPayment}
                rescheduleBillOccurrence={rescheduleBillOccurrence}
                undoReschedule={undoReschedule}
              />
            ))}
          </div>
        )}

        <h2 className="mb-3 mt-6 text-xs font-bold uppercase tracking-wide text-slate-400">Expenses</h2>
        {!expenseBills.length ? (
          <EmptyState message="No expenses due this week." />
        ) : (
          <div className="space-y-2">
            {expenseBills.map((b) => (
              <PaidCheckbox
                key={b.id}
                billId={b.id}
                name={b.name}
                category={b.category}
                amount={Number(b.amount)}
                naturalDueDate={format(b.occurrence, "yyyy-MM-dd")}
                weekStart={periodStart}
                isIncome={false}
                moved={b.moved}
                paid={paidByBill.get(b.id) ?? null}
                markBillPaid={markBillPaid}
                deleteBillPayment={deleteBillPayment}
                rescheduleBillOccurrence={rescheduleBillOccurrence}
                undoReschedule={undoReschedule}
              />
            ))}
          </div>
        )}
      </Card>

      {!isCurrentWeek && (
        <p className="mt-4 text-center text-xs text-slate-400">
          <Link href="/budget" className="font-medium text-teal-600 hover:underline">
            Jump back to this week
          </Link>
        </p>
      )}
    </div>
  );
}
