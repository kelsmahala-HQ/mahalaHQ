import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { markRedemptionPaid } from "./rewards-actions";

/**
 * What you actually owe in real money: approved redemptions of cash-value rewards that haven't
 * been marked paid yet. Points are the currency; this only counts the ones a kid cashed in.
 */
export default async function CashOwed({ householdId, hideWhenEmpty = false }: { householdId: string; hideWhenEmpty?: boolean }) {
  const supabase = await createClient();

  const [{ data: owed }, { data: paid }, { data: members }] = await Promise.all([
    supabase
      .from("reward_redemptions")
      .select("id, member_id, reward_name, cash_value, decided_at")
      .eq("household_id", householdId)
      .eq("status", "approved")
      .not("cash_value", "is", null)
      .is("paid_at", null)
      .order("decided_at"),
    supabase
      .from("reward_redemptions")
      .select("id, member_id, reward_name, cash_value, paid_at")
      .eq("household_id", householdId)
      .not("cash_value", "is", null)
      .not("paid_at", "is", null)
      .order("paid_at", { ascending: false })
      .limit(8),
    supabase.from("household_members").select("id, display_name").eq("household_id", householdId),
  ]);

  if (hideWhenEmpty && !owed?.length) return null;

  const nameById = new Map((members ?? []).map((m) => [m.id, m.display_name]));
  const total = (owed ?? []).reduce((sum, r) => sum + (r.cash_value ?? 0), 0);

  const byMember = new Map<string, NonNullable<typeof owed>>();
  for (const r of owed ?? []) {
    if (!byMember.has(r.member_id)) byMember.set(r.member_id, []);
    byMember.get(r.member_id)!.push(r);
  }

  return (
    <Card className="mb-8 !bg-emerald-50">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-700">💵 Cash to pay out</h2>
        <span className="text-lg font-bold text-emerald-700">${total}</span>
      </div>

      {!owed?.length ? (
        <p className="text-sm text-slate-500">Nothing owed right now. Cash rewards show up here once you approve them.</p>
      ) : (
        <div className="space-y-3">
          {[...byMember].map(([memberId, rows]) => (
            <div key={memberId}>
              <p className="mb-1 flex justify-between text-sm font-semibold text-slate-800">
                <span>{nameById.get(memberId) ?? "Someone"}</span>
                <span>${rows.reduce((s, r) => s + (r.cash_value ?? 0), 0)}</span>
              </p>
              <div className="space-y-1">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                    <span className="text-sm text-slate-900">
                      {r.reward_name} <span className="font-medium text-emerald-700">${r.cash_value}</span>
                      {r.decided_at && (
                        <span className="ml-2 text-xs text-slate-400">approved {format(new Date(r.decided_at), "MMM d")}</span>
                      )}
                    </span>
                    <form action={markRedemptionPaid}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                        Mark paid
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!!paid?.length && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-500">Recently paid</summary>
          <div className="mt-2 space-y-1">
            {paid.map((r) => (
              <p key={r.id} className="flex justify-between text-xs text-slate-500">
                <span>
                  {nameById.get(r.member_id) ?? "Someone"} · {r.reward_name}
                </span>
                <span>
                  ${r.cash_value} · {r.paid_at ? format(new Date(r.paid_at), "MMM d") : ""}
                </span>
              </p>
            ))}
          </div>
        </details>
      )}
    </Card>
  );
}
