import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireHousehold } from "@/lib/household";
import { Card, EmptyState, PageHeader, buttonClass, iconButtonClass, inputClass } from "@/components/ui";
import { calculateRoundUp } from "@/lib/roundup";
import { addPurchase, sendPayout, updateSettings } from "./actions";
import { removePlaidItem, syncTransactions } from "./plaid-actions";
import PlaidLinkButton from "./plaid-link-button";

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function RoundupPage() {
  const household = await requireHousehold();
  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: settingsRow }, { data: focusDebt }, { data: purchases }, { data: payouts }, { data: plaidItems }] =
    await Promise.all([
      supabase.from("roundup_settings").select("*").eq("household_id", household.householdId).maybeSingle(),
      supabase
        .from("debts")
        .select("id, name, current_balance")
        .eq("household_id", household.householdId)
        .eq("is_focus", true)
        .maybeSingle(),
      supabase
        .from("roundup_purchases")
        .select("*")
        .eq("household_id", household.householdId)
        .order("created_at", { ascending: false }),
      supabase.from("roundup_payouts").select("amount").eq("household_id", household.householdId),
      admin
        .from("plaid_items")
        .select("id, institution_name, created_at")
        .eq("household_id", household.householdId)
        .order("created_at"),
    ]);

  const multiplier = Number(settingsRow?.multiplier ?? 2);
  const threshold = Number(settingsRow?.threshold ?? 25);

  const totalSaved = (purchases ?? []).reduce((sum, p) => sum + Number(p.round_up), 0);
  const totalPaidOut = (payouts ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const available = Math.max(0, totalSaved - totalPaidOut);
  const pct = threshold > 0 ? Math.min(100, Math.round((available / threshold) * 100)) : 0;
  const readyToSend = available >= threshold && !!focusDebt;

  return (
    <div>
      <PageHeader
        title="Round-Up"
        subtitle="Every purchase rounds up to the next dollar (× your multiplier) and stacks toward a payment on your focus debt."
      />

      <Card className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">
            Focus debt:{" "}
            {focusDebt ? (
              <span className="text-teal-700">{focusDebt.name}</span>
            ) : (
              <Link href="/debts" className="text-red-600 underline">
                none set — pick one on the Debts page
              </Link>
            )}
          </p>
          <p className="text-sm text-slate-500">
            {currency(available)} / {currency(threshold)}
          </p>
        </div>
        <div className="h-3 w-full rounded-full bg-slate-100">
          <div className="h-3 rounded-full bg-yellow-400" style={{ width: `${pct}%` }} />
        </div>

        {readyToSend && (
          <form action={sendPayout} className="mt-4">
            <input type="hidden" name="debt_id" value={focusDebt!.id} />
            <input type="hidden" name="amount" value={threshold} />
            <button type="submit" className={buttonClass}>
              Send {currency(threshold)} to {focusDebt!.name} 🎉
            </button>
            <p className="mt-1 text-xs text-slate-400">
              This logs the payment here — you still need to actually send the money yourself.
            </p>
          </form>
        )}
      </Card>

      <Card className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Connected banks</h2>
          {!!plaidItems?.length && (
            <form action={syncTransactions}>
              <button className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100">
                Sync transactions now
              </button>
            </form>
          )}
        </div>

        {!plaidItems?.length ? (
          <div>
            <p className="mb-3 text-sm text-slate-500">
              Connect a bank to automatically pull in purchases instead of logging them by hand.
            </p>
            <PlaidLinkButton />
          </div>
        ) : (
          <div className="space-y-2">
            {plaidItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-900">{item.institution_name ?? "Bank account"}</span>
                <form action={removePlaidItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className={iconButtonClass}>Disconnect</button>
                </form>
              </div>
            ))}
            <PlaidLinkButton />
          </div>
        )}
      </Card>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Log a purchase manually</h2>
          <form action={addPurchase} className="grid grid-cols-1 gap-3">
            <input name="amount" type="number" step="0.01" min="0.01" required placeholder="Purchase amount" className={inputClass} />
            <button type="submit" className={buttonClass}>
              Add
            </button>
          </form>
          <p className="mt-2 text-xs text-slate-400">
            Rounds up to the next dollar × {multiplier}. e.g. a {currency(4.3)} purchase adds {currency(calculateRoundUp(4.3, multiplier))}.
          </p>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Settings</h2>
          <form action={updateSettings} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Round-up multiplier</label>
              <input name="multiplier" type="number" step="0.5" min="1" defaultValue={multiplier} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Payment threshold</label>
              <input name="threshold" type="number" step="1" min="1" defaultValue={threshold} className={inputClass} />
            </div>
            <button type="submit" className={`${buttonClass} sm:col-span-2`}>
              Save settings
            </button>
          </form>
        </Card>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-slate-700">Recent purchases</h2>
      {!purchases?.length ? (
        <EmptyState message="No purchases logged yet." />
      ) : (
        <div className="space-y-2">
          {purchases.slice(0, 15).map((p) => (
            <Card key={p.id} className="flex items-center justify-between !p-3">
              <span className="text-sm text-slate-900">
                {p.merchant_name || currency(Number(p.amount))}
                {p.merchant_name && <span className="text-slate-400"> · {currency(Number(p.amount))}</span>}
              </span>
              <span className="text-sm font-medium text-yellow-700">+{currency(Number(p.round_up))}</span>
              <span className="text-xs text-slate-400">{new Date(p.created_at).toLocaleDateString()}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
