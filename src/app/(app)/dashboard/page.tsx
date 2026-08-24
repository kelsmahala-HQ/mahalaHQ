import Link from "next/link";
import { endOfWeek, format, startOfWeek } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { Card, PageHeader } from "@/components/ui";
import { PAY_PERIOD_OPTS, applyReschedules, occurrenceInPeriod } from "@/lib/pay-period";
import { wallClockDate } from "@/lib/wall-clock";
import KidDashboard from "./kid-dashboard";
import SitterDashboard from "./sitter-dashboard";

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function DashboardPage() {
  const household = await requireHousehold();
  if (household.role === "kid") return <KidDashboard household={household} />;
  if (household.role === "sitter") return <SitterDashboard household={household} />;

  const supabase = await createClient();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekAhead = new Date(now.getTime() + 7 * 86400000).toISOString();
  const periodStartDate = startOfWeek(now, PAY_PERIOD_OPTS);
  const periodEndDate = endOfWeek(now, PAY_PERIOD_OPTS);
  const periodStart = format(periodStartDate, "yyyy-MM-dd");
  const periodEnd = format(periodEndDate, "yyyy-MM-dd");

  const [
    { data: upcomingEvents },
    { data: openChores },
    { count: groceryCount },
    { data: overdueMaintenance },
    { data: debts },
    { data: bills },
    { data: billPayments },
    { data: reschedules },
    { data: roundupSettings },
    { data: focusDebt },
    { data: roundupPurchases },
    { data: roundupPayouts },
  ] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("*")
      .eq("household_id", household.householdId)
      .gte("start_at", new Date().toISOString())
      .lte("start_at", weekAhead)
      .order("start_at")
      .limit(5),
    supabase
      .from("chores")
      .select("*")
      .eq("household_id", household.householdId)
      .eq("status", "open")
      .order("due_date", { nullsFirst: false })
      .limit(5),
    supabase
      .from("grocery_items")
      .select("id", { count: "exact", head: true })
      .eq("household_id", household.householdId)
      .eq("is_checked", false),
    supabase
      .from("maintenance_tasks")
      .select("*")
      .eq("household_id", household.householdId)
      .lt("next_due_at", todayStr)
      .order("next_due_at"),
    supabase.from("debts").select("current_balance").eq("household_id", household.householdId),
    supabase.from("bills").select("*").eq("household_id", household.householdId),
    supabase
      .from("bill_payments")
      .select("bill_id, amount")
      .eq("household_id", household.householdId)
      .gte("paid_on", periodStart)
      .lte("paid_on", periodEnd),
    supabase
      .from("bill_reschedules")
      .select("bill_id, original_due_date, moved_to_week_start")
      .eq("household_id", household.householdId),
    supabase.from("roundup_settings").select("*").eq("household_id", household.householdId).maybeSingle(),
    supabase
      .from("debts")
      .select("id, name")
      .eq("household_id", household.householdId)
      .eq("is_focus", true)
      .maybeSingle(),
    supabase.from("roundup_purchases").select("round_up").eq("household_id", household.householdId),
    supabase.from("roundup_payouts").select("amount").eq("household_id", household.householdId),
  ]);

  const totalDebt = (debts ?? []).reduce((sum, d) => sum + Number(d.current_balance), 0);

  const paidByBill = new Map<string, number>();
  for (const p of billPayments ?? []) paidByBill.set(p.bill_id, Number(p.amount));
  const naturalThisPeriod = (bills ?? [])
    .map((b) => ({ ...b, occurrence: occurrenceInPeriod(b, periodStartDate, periodEndDate) }))
    .filter((b): b is typeof b & { occurrence: Date } => b.occurrence !== null);
  const billsThisPeriod = applyReschedules(bills ?? [], naturalThisPeriod, reschedules ?? [], periodStartDate).sort(
    (a, b) => a.occurrence.getTime() - b.occurrence.getTime()
  );
  // Everything due this period counts whether it's been paid yet or not, but a bill's actual
  // paid amount (once it has one) replaces the estimate.
  const totalIncome = billsThisPeriod
    .filter((b) => b.type === "income")
    .reduce((sum, b) => sum + (paidByBill.get(b.id) ?? Number(b.amount)), 0);
  const totalExpense = billsThisPeriod
    .filter((b) => b.type === "expense")
    .reduce((sum, b) => sum + (paidByBill.get(b.id) ?? Number(b.amount)), 0);
  const remaining = totalIncome - totalExpense;
  const unpaidBillsThisPeriod = billsThisPeriod.filter((b) => b.type === "expense" && !paidByBill.has(b.id));

  const roundupThreshold = Number(roundupSettings?.threshold ?? 25);
  const roundupSaved = (roundupPurchases ?? []).reduce((sum, p) => sum + Number(p.round_up), 0);
  const roundupPaidOut = (roundupPayouts ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const roundupAvailable = Math.max(0, roundupSaved - roundupPaidOut);
  const roundupPct = roundupThreshold > 0 ? Math.min(100, Math.round((roundupAvailable / roundupThreshold) * 100)) : 0;

  return (
    <div>
      <PageHeader title={`Welcome, ${household.displayName}`} subtitle={household.householdName} />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-lg">🛒</span>
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Groceries to buy</p>
            <p className="text-2xl font-semibold text-slate-900">{groceryCount ?? 0}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-lg">🧹</span>
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Open chores</p>
            <p className="text-2xl font-semibold text-slate-900">{openChores?.length ?? 0}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-lg">📉</span>
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Total debt</p>
            <p className="text-2xl font-semibold text-slate-900">{currency(totalDebt)}</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Upcoming this week</h2>
            <Link href="/calendar" className="text-xs text-teal-600 hover:underline">
              View calendar
            </Link>
          </div>
          {!upcomingEvents?.length ? (
            <p className="text-sm text-slate-400">Nothing on the calendar this week.</p>
          ) : (
            <ul className="space-y-2">
              {upcomingEvents.map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                  <span className="text-slate-400">
                    {wallClockDate(e.start_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  <span className="text-slate-900">{e.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Open chores</h2>
            <Link href="/chores" className="text-xs text-teal-600 hover:underline">
              View chores
            </Link>
          </div>
          {!openChores?.length ? (
            <p className="text-sm text-slate-400">All chores done. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {openChores.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-900">{c.title}</span>
                  <span className="text-slate-400">{c.assigned_to}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">This pay period</h2>
            <Link href="/budget" className="text-xs text-teal-600 hover:underline">
              View budget
            </Link>
          </div>
          <p className="mb-3 text-xs text-slate-400">
            {format(periodStartDate, "MMM d")} – {format(periodEndDate, "MMM d")}
          </p>
          <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-sm text-slate-500">Remaining</span>
            <span className={`text-lg font-semibold ${remaining < 0 ? "text-red-600" : "text-slate-900"}`}>
              {currency(remaining)}
            </span>
          </div>
          {!unpaidBillsThisPeriod.length ? (
            <p className="text-sm text-slate-400">Nothing left to pay this period. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {unpaidBillsThisPeriod.slice(0, 4).map((b) => (
                <li key={b.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-900">{b.name}</span>
                  <span className="text-slate-400">
                    {currency(Number(b.amount))} · due {format(b.occurrence!, "MMM d")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Round-Up</h2>
            <Link href="/roundup" className="text-xs text-teal-600 hover:underline">
              View round-up
            </Link>
          </div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-slate-500">{focusDebt ? `Toward ${focusDebt.name}` : "No focus debt set"}</span>
            <span className="text-sm text-slate-500">
              {currency(roundupAvailable)} / {currency(roundupThreshold)}
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-100">
            <div className="h-3 rounded-full bg-yellow-400" style={{ width: `${roundupPct}%` }} />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Overdue maintenance</h2>
            <Link href="/maintenance" className="text-xs text-teal-600 hover:underline">
              View maintenance
            </Link>
          </div>
          {!overdueMaintenance?.length ? (
            <p className="text-sm text-slate-400">Nothing overdue.</p>
          ) : (
            <ul className="space-y-2">
              {overdueMaintenance.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-900">{t.title}</span>
                  <span className="font-medium text-red-600">since {t.next_due_at}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
