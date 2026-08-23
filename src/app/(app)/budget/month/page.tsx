import Link from "next/link";
import { addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireAdult } from "@/lib/household";
import { Card, PageHeader } from "@/components/ui";
import { PAY_PERIOD_OPTS, applyReschedules, occurrenceInPeriod, weeksInMonth } from "@/lib/pay-period";

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function BudgetMonthPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const household = await requireAdult();
  const supabase = await createClient();
  const { month } = await searchParams;

  const anchor = month ? new Date(`${month}-01T00:00:00`) : new Date();
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const weeks = weeksInMonth(monthStart, monthEnd);
  const rangeStart = format(weeks[0], "yyyy-MM-dd");
  const rangeEnd = format(endOfWeek(weeks[weeks.length - 1], PAY_PERIOD_OPTS), "yyyy-MM-dd");

  const [{ data: bills }, { data: payments }, { data: reschedules }] = await Promise.all([
    supabase.from("bills").select("*").eq("household_id", household.householdId),
    supabase
      .from("bill_payments")
      .select("bill_id, amount, paid_on")
      .eq("household_id", household.householdId)
      .gte("paid_on", rangeStart)
      .lte("paid_on", rangeEnd),
    supabase.from("bill_reschedules").select("*").eq("household_id", household.householdId),
  ]);

  const billsById = new Map((bills ?? []).map((b) => [b.id, b]));
  const currentWeekStart = format(startOfWeek(new Date(), PAY_PERIOD_OPTS), "yyyy-MM-dd");

  const weekRows = weeks.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, PAY_PERIOD_OPTS);
    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const weekEndStr = format(weekEnd, "yyyy-MM-dd");

    const natural = (bills ?? [])
      .map((b) => ({ ...b, occurrence: occurrenceInPeriod(b, weekStart, weekEnd) }))
      .filter((b): b is typeof b & { occurrence: Date } => b.occurrence !== null);
    const billsThisWeek = applyReschedules(bills ?? [], natural, reschedules ?? [], weekStart);

    let income = 0;
    let expense = 0;
    for (const p of payments ?? []) {
      if (p.paid_on < weekStartStr || p.paid_on > weekEndStr) continue;
      const bill = billsById.get(p.bill_id);
      if (!bill) continue;
      if (bill.type === "income") income += Number(p.amount);
      else expense += Number(p.amount);
    }

    const tag = billsThisWeek
      .filter((b) => b.type === "income")
      .map((b) => b.assigned_to)
      .filter(Boolean)
      .join(" & ");

    return { weekStartStr, weekEndStr, income, expense, remaining: income - expense, tag };
  });

  const monthIncome = weekRows.reduce((sum, w) => sum + w.income, 0);
  const monthExpense = weekRows.reduce((sum, w) => sum + w.expense, 0);
  const monthRemaining = monthIncome - monthExpense;

  const prevMonth = format(subMonths(monthStart, 1), "yyyy-MM");
  const nextMonth = format(addMonths(monthStart, 1), "yyyy-MM");

  return (
    <div>
      <PageHeader title="Budget" subtitle="Month rollup — click into any week for the full breakdown." />

      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <Link href={`/budget/month?month=${prevMonth}`} className="text-sm font-semibold text-slate-500 hover:text-teal-600">
            ← Prev month
          </Link>
          <h2 className="text-base font-bold text-slate-900">{format(monthStart, "MMMM yyyy")}</h2>
          <Link href={`/budget/month?month=${nextMonth}`} className="text-sm font-semibold text-slate-500 hover:text-teal-600">
            Next month →
          </Link>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase text-slate-400">Income</p>
          <p className="mt-1 text-2xl font-semibold text-teal-600">{currency(monthIncome)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-slate-400">Expenses</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{currency(monthExpense)}</p>
        </Card>
        <Card className={monthRemaining < 0 ? "!bg-red-50" : "!bg-yellow-50"}>
          <p className="text-xs font-medium uppercase text-slate-400">Remaining</p>
          <p className={`mt-1 text-2xl font-semibold ${monthRemaining < 0 ? "text-red-600" : "text-slate-900"}`}>
            {currency(monthRemaining)}
          </p>
        </Card>
      </div>

      <p className="mb-3 text-xs text-slate-400">
        Weeks are grouped by their starting Friday — a week may run into next month if that&rsquo;s when its Friday lands.
      </p>

      <div className="space-y-2">
        {weekRows.map((w) => {
          const isCurrent = w.weekStartStr === currentWeekStart;
          return (
            <Link
              key={w.weekStartStr}
              href={`/budget?week=${w.weekStartStr}`}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 shadow-sm hover:border-teal-200 hover:bg-teal-50 ${
                isCurrent ? "border-yellow-300 bg-yellow-50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="text-sm font-bold text-slate-900">
                {format(new Date(`${w.weekStartStr}T00:00:00`), "MMM d")} –{" "}
                {format(new Date(`${w.weekEndStr}T00:00:00`), "MMM d")}
                {w.tag && <span className="ml-2 text-xs font-medium text-slate-400">{w.tag}</span>}
                {isCurrent && <span className="ml-2 text-xs font-medium text-teal-600">this week</span>}
              </div>
              <div className="flex gap-5 text-sm">
                <div className="text-right">
                  <p className="text-[10px] uppercase text-slate-400">Income</p>
                  <p className="font-semibold text-teal-700">{currency(w.income)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-slate-400">Expenses</p>
                  <p className="font-semibold text-red-600">{currency(w.expense)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-slate-400">Remaining</p>
                  <p className={`font-semibold ${w.remaining < 0 ? "text-red-600" : "text-slate-900"}`}>
                    {currency(w.remaining)}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
