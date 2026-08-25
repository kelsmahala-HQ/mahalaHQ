import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdult } from "@/lib/household";
import { Card, CollapsibleCard, EmptyState, PageHeader } from "@/components/ui";
import AddDebtForm from "./add-debt-form";
import DebtRow from "./debt-row";

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function DebtsPage() {
  const household = await requireAdult();
  const supabase = await createClient();
  const [{ data: debts }, { data: linkedBills }] = await Promise.all([
    supabase
      .from("debts")
      .select("*")
      .eq("household_id", household.householdId)
      .order("interest_rate", { ascending: false, nullsFirst: false }),
    supabase.from("bills").select("debt_id").eq("household_id", household.householdId).not("debt_id", "is", null),
  ]);
  const debtIdsInBudget = new Set((linkedBills ?? []).map((b) => b.debt_id));

  const totalBalance = (debts ?? []).reduce((sum, d) => sum + Number(d.current_balance), 0);
  const totalMinPayments = (debts ?? []).reduce((sum, d) => sum + Number(d.minimum_payment ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Debts"
        subtitle="Track balances and payoff progress. Payments are logged manually — no bank linking or auto-pay."
      />

      <Card className="mb-8 !bg-yellow-50">
        <p className="text-sm text-slate-700">
          Mark one debt as your <strong>focus</strong> (⭐) — that&rsquo;s the one your{" "}
          <Link href="/roundup" className="font-medium text-teal-700 underline">
            Round-Up tracker
          </Link>{" "}
          sends spare change toward.
        </p>
      </Card>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs font-medium uppercase text-slate-400">Total balance</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{currency(totalBalance)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-slate-400">Total minimum payments / mo</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{currency(totalMinPayments)}</p>
        </Card>
      </div>

      <CollapsibleCard title="Add a debt" className="mb-8">
        <AddDebtForm />
      </CollapsibleCard>

      {!debts?.length ? (
        <EmptyState message="No debts tracked yet — add one above." />
      ) : (
        <div className="space-y-4">
          {debts.map((d) => (
            <DebtRow key={d.id} debt={d} inBudget={debtIdsInBudget.has(d.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
