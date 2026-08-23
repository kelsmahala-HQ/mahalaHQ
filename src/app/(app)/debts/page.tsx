import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { Card, EmptyState, PageHeader, buttonClass, iconButtonClass, inputClass } from "@/components/ui";
import { addDebt, deleteDebt, logPayment, setFocusDebt } from "./actions";

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function DebtsPage() {
  const household = await requireHousehold();
  const supabase = await createClient();
  const { data: debts } = await supabase
    .from("debts")
    .select("*")
    .eq("household_id", household.householdId)
    .order("interest_rate", { ascending: false, nullsFirst: false });

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

      <Card className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Add a debt</h2>
        <form action={addDebt} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input name="name" required placeholder="Name (e.g. Chase Visa)" className={inputClass} />
          <input name="creditor" placeholder="Creditor" className={inputClass} />
          <input name="current_balance" type="number" step="0.01" required placeholder="Current balance" className={inputClass} />
          <input name="interest_rate" type="number" step="0.01" placeholder="Interest rate %" className={inputClass} />
          <input name="minimum_payment" type="number" step="0.01" placeholder="Minimum payment" className={inputClass} />
          <input name="due_day" type="number" min={1} max={31} placeholder="Due day of month" className={inputClass} />
          <button type="submit" className={`${buttonClass} sm:col-span-2`}>
            Add debt
          </button>
        </form>
      </Card>

      {!debts?.length ? (
        <EmptyState message="No debts tracked yet — add one above." />
      ) : (
        <div className="space-y-4">
          {debts.map((d) => {
            const original = Number(d.original_balance ?? d.current_balance);
            const current = Number(d.current_balance);
            const paidPct = original > 0 ? Math.min(100, Math.round(((original - current) / original) * 100)) : 0;
            return (
              <Card key={d.id} className={d.is_focus ? "ring-2 ring-yellow-400" : ""}>
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
                          d.due_day ? `due day ${d.due_day}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  <form action={deleteDebt}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className={iconButtonClass}>Remove</button>
                  </form>
                </div>

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
          })}
        </div>
      )}
    </div>
  );
}
