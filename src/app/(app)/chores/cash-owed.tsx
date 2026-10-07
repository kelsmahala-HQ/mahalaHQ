import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { markRedemptionPaid } from "./rewards-actions";
import { markAllGradeAwardsPaid, markGradeAwardPaid } from "../grades/actions";
import { formatMoney, round2 } from "@/lib/grades";

type Item = {
  key: string;
  kind: "reward" | "grade";
  id: string;
  member_id: string;
  label: string;
  dollars: number;
  when: string | null;
};

/**
 * What you actually owe in real money: weekly grade payouts and the quarter-end bonus, plus any
 * approved cash reward a kid cashed in -- each stays on the list until you mark it paid.
 */
export default async function CashOwed({ householdId, hideWhenEmpty = false }: { householdId: string; hideWhenEmpty?: boolean }) {
  const supabase = await createClient();

  const [{ data: owedRewards }, { data: paidRewards }, { data: owedGrades }, { data: paidGrades }, { data: members }] = await Promise.all([
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
    supabase
      .from("grade_awards")
      .select("*")
      .eq("household_id", householdId)
      .gt("dollars", 0)
      .is("paid_at", null)
      .order("created_at"),
    supabase
      .from("grade_awards")
      .select("id, member_id, description, dollars, paid_at")
      .eq("household_id", householdId)
      .gt("dollars", 0)
      .not("paid_at", "is", null)
      .order("paid_at", { ascending: false })
      .limit(8),
    supabase.from("household_members").select("id, display_name").eq("household_id", householdId),
  ]);

  const owed: Item[] = [
    // Held pay (she's over the stay-in limit) and forfeited pay aren't owed yet.
    ...(owedGrades ?? []).filter((g) => !g.held && !g.forfeited).map((g) => ({
      key: `g-${g.id}`,
      kind: "grade" as const,
      id: g.id,
      member_id: g.member_id,
      label: `📚 ${g.description ?? "Weekly grades"}`,
      dollars: g.dollars,
      when: g.taken_on ?? g.created_at,
    })),
    ...(owedRewards ?? []).map((r) => ({
      key: `r-${r.id}`,
      kind: "reward" as const,
      id: r.id,
      member_id: r.member_id,
      label: r.reward_name,
      dollars: r.cash_value ?? 0,
      when: r.decided_at,
    })),
  ];

  if (hideWhenEmpty && !owed.length) return null;

  const nameById = new Map((members ?? []).map((m) => [m.id, m.display_name]));
  const total = round2(owed.reduce((sum, i) => sum + i.dollars, 0));

  const byMember = new Map<string, Item[]>();
  for (const item of owed) {
    if (!byMember.has(item.member_id)) byMember.set(item.member_id, []);
    byMember.get(item.member_id)!.push(item);
  }

  const paid = [
    ...(paidGrades ?? []).map((g) => ({
      key: `g-${g.id}`,
      member_id: g.member_id,
      label: `📚 ${g.description ?? "Weekly grades"}`,
      dollars: g.dollars,
      paid_at: g.paid_at as string,
    })),
    ...(paidRewards ?? []).map((r) => ({
      key: `r-${r.id}`,
      member_id: r.member_id,
      label: r.reward_name,
      dollars: r.cash_value ?? 0,
      paid_at: r.paid_at as string,
    })),
  ]
    .sort((a, z) => z.paid_at.localeCompare(a.paid_at))
    .slice(0, 8);

  return (
    <Card className="mb-8 !bg-emerald-50">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-700">💵 Cash to pay out</h2>
        <span className="text-lg font-bold text-emerald-700">{formatMoney(total)}</span>
      </div>

      {!owed.length ? (
        <p className="text-sm text-slate-500">Nothing owed right now. Weekly grade pay and approved cash rewards show up here.</p>
      ) : (
        <div className="space-y-3">
          {[...byMember].map(([memberId, rows]) => {
            const gradeRows = rows.filter((r) => r.kind === "grade");
            return (
              <div key={memberId}>
                <p className="mb-1 flex items-center justify-between gap-2 text-sm font-semibold text-slate-800">
                  <span>
                    {nameById.get(memberId) ?? "Someone"} · {formatMoney(rows.reduce((s, r) => s + r.dollars, 0))}
                  </span>
                  {gradeRows.length > 1 && (
                    <form action={markAllGradeAwardsPaid}>
                      <input type="hidden" name="member_id" value={memberId} />
                      <button className="text-xs font-medium text-emerald-700 hover:underline">
                        Mark all grade pay paid ({formatMoney(gradeRows.reduce((s, r) => s + r.dollars, 0))})
                      </button>
                    </form>
                  )}
                </p>
                <div className="space-y-1">
                  {rows.map((r) => (
                    <div key={r.key} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                      <span className="text-sm text-slate-900">
                        {r.label} <span className="font-medium text-emerald-700">{formatMoney(r.dollars)}</span>
                        {r.when && <span className="ml-2 text-xs text-slate-400">{format(new Date(r.when), "MMM d")}</span>}
                      </span>
                      <form action={r.kind === "grade" ? markGradeAwardPaid : markRedemptionPaid}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                          Mark paid
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!!paid.length && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-500">Recently paid</summary>
          <div className="mt-2 space-y-1">
            {paid.map((r) => (
              <p key={r.key} className="flex justify-between text-xs text-slate-500">
                <span>
                  {nameById.get(r.member_id) ?? "Someone"} · {r.label}
                </span>
                <span>
                  {formatMoney(r.dollars)} · {format(new Date(r.paid_at), "MMM d")}
                </span>
              </p>
            ))}
          </div>
        </details>
      )}
    </Card>
  );
}
