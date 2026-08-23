import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { Card, PageHeader } from "@/components/ui";
import KidDashboard from "./kid-dashboard";

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function DashboardPage() {
  const household = await requireHousehold();
  if (household.role === "kid") return <KidDashboard household={household} />;

  const supabase = await createClient();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekAhead = new Date(now.getTime() + 7 * 86400000).toISOString();

  const [
    { data: upcomingEvents },
    { data: openChores },
    { data: groceryItems },
    { data: overdueMaintenance },
    { data: debts },
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
  ]);

  const totalDebt = (debts ?? []).reduce((sum, d) => sum + Number(d.current_balance), 0);

  return (
    <div>
      <PageHeader title={`Welcome, ${household.displayName}`} subtitle={household.householdName} />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-lg">🛒</span>
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Groceries to buy</p>
            <p className="text-2xl font-semibold text-slate-900">{groceryItems?.length ?? 0}</p>
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
                    {new Date(e.start_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
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
