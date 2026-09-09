import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { Card, CollapsibleCard, EmptyState, PageHeader, iconButtonClass } from "@/components/ui";
import { daysOfWeekLabel } from "@/lib/weekdays";
import { deleteReward, approveRedemption, denyRedemption } from "./rewards-actions";
import AddChoreForm from "./add-chore-form";
import AddRewardForm from "./add-reward-form";
import ChoreRow from "./chore-row";
import RedeemButton from "./redeem-button";

function frequencyLabel(frequency: string, daysOfWeek: number[] | null) {
  return daysOfWeekLabel(daysOfWeek) ?? frequency;
}

/** A short, friendly due-date status instead of a raw "due 2026-09-10" string -- "Due today"/
 *  "Due tomorrow" read at a glance, everything else falls back to a plain "Due Sep 10". */
function dueStatus(dueDate: string | null, todayStr: string): { text: string; tone: "overdue" | "today" | "later" } | null {
  if (!dueDate) return null;
  if (dueDate < todayStr) return { text: `Overdue since ${format(new Date(`${dueDate}T00:00:00`), "MMM d")}`, tone: "overdue" };
  if (dueDate === todayStr) return { text: "Due today", tone: "today" };
  const tomorrowStr = format(addDays(new Date(`${todayStr}T00:00:00`), 1), "yyyy-MM-dd");
  if (dueDate === tomorrowStr) return { text: "Due tomorrow", tone: "later" };
  return { text: `Due ${format(new Date(`${dueDate}T00:00:00`), "MMM d")}`, tone: "later" };
}

export default async function ChoresPage() {
  const household = await requireHousehold();
  const supabase = await createClient();
  const isKid = household.role === "kid";
  const canManage = household.role === "admin" || household.role === "adult";

  // For a kid, resolve which chores they're assigned to first (a plain lookup, not an embedded
  // join in the select string -- Supabase's typed select-string parser chokes on a computed
  // "!inner" embed passed conditionally), then filter the main chores query with .in().
  let assignedChoreIds: string[] | null = null;
  if (isKid) {
    const { data: assignedRows } = await supabase.from("chore_assignees").select("chore_id").eq("member_id", household.memberId);
    assignedChoreIds = (assignedRows ?? []).map((r) => r.chore_id);
  }

  const [{ data: members }, choresQuery, { data: rewards }, { data: pendingRedemptions }] = await Promise.all([
    supabase.from("household_members").select("id, display_name").eq("household_id", household.householdId).order("display_name"),
    assignedChoreIds && !assignedChoreIds.length
      ? Promise.resolve({ data: [] })
      : (() => {
          let query = supabase
            .from("chores")
            .select("*")
            .eq("household_id", household.householdId)
            .order("status")
            .order("due_date", { nullsFirst: false });
          if (assignedChoreIds) query = query.in("id", assignedChoreIds);
          return query;
        })(),
    canManage ? supabase.from("rewards").select("*").eq("household_id", household.householdId).order("cost") : Promise.resolve({ data: [] }),
    canManage
      ? supabase
          .from("reward_redemptions")
          .select("*")
          .eq("household_id", household.householdId)
          .eq("status", "pending")
          .order("requested_at")
      : Promise.resolve({ data: [] }),
  ]);
  const { data: chores } = choresQuery;
  const memberNameById = new Map((members ?? []).map((m) => [m.id, m.display_name]));
  const todayStr = new Date().toISOString().slice(0, 10);

  const kidRewards = (rewards ?? []).filter((r) => r.audience !== "adult");
  const adultRewards = (rewards ?? []).filter((r) => r.audience === "adult");
  const ownPendingRewardIds = new Set(
    (pendingRedemptions ?? []).filter((r) => r.member_id === household.memberId).map((r) => r.reward_id)
  );

  // Your own points, private to you -- same balance math as the kid dashboard, just scoped to
  // the signed-in admin/adult instead of a kid. Only computed when it'll actually be shown.
  const [{ data: ownCompletions }, { data: ownRedemptions }] = canManage
    ? await Promise.all([
        supabase.from("chore_completions").select("points").eq("member_id", household.memberId),
        supabase.from("reward_redemptions").select("cost").eq("member_id", household.memberId).in("status", ["pending", "approved"]),
      ])
    : [{ data: [] as { points: number }[] }, { data: [] as { cost: number }[] }];
  const ownEarned = (ownCompletions ?? []).reduce((sum, c) => sum + c.points, 0);
  const ownReserved = (ownRedemptions ?? []).reduce((sum, r) => sum + r.cost, 0);
  const ownBalance = ownEarned - ownReserved;

  const choreIds = (chores ?? []).map((c) => c.id);
  const { data: assigneeRows } = choreIds.length
    ? await supabase.from("chore_assignees").select("chore_id, member_id").in("chore_id", choreIds)
    : { data: [] as { chore_id: string; member_id: string }[] };
  const assigneesByChore = new Map<string, string[]>();
  for (const row of assigneeRows ?? []) {
    if (!assigneesByChore.has(row.chore_id)) assigneesByChore.set(row.chore_id, []);
    assigneesByChore.get(row.chore_id)!.push(row.member_id);
  }

  return (
    <div>
      <PageHeader
        title={isKid ? "Your Chores" : "Chores"}
        subtitle={isKid ? "Everything assigned to you." : "Assign tasks and track who's done what."}
      />

      {canManage && (
        <CollapsibleCard title="Add a chore" className="mb-8">
          <AddChoreForm members={members ?? []} />
        </CollapsibleCard>
      )}

      {canManage && !!pendingRedemptions?.length && (
        <Card className="mb-8 !bg-yellow-50">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">🎁 Reward requests waiting on you</h2>
          <div className="space-y-2">
            {pendingRedemptions.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                <p className="text-sm text-slate-900">
                  <span className="font-medium">{memberNameById.get(r.member_id) ?? "Someone"}</span> wants{" "}
                  <span className="font-medium">{r.reward_name}</span> <span className="text-slate-400">(⭐ {r.cost})</span>
                </p>
                <div className="flex gap-2">
                  <form action={approveRedemption}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-lg bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100">
                      Approve
                    </button>
                  </form>
                  <form action={denyRedemption}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-lg bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100">
                      Deny
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!chores?.length ? (
        <EmptyState message={isKid ? "Nothing assigned to you right now. 🎉" : "No chores yet — add one above."} />
      ) : (
        <div className="space-y-2">
          {chores.map((chore) => (
            <ChoreRow
              key={chore.id}
              chore={chore}
              due={dueStatus(chore.due_date, todayStr)}
              isKid={isKid}
              canManage={canManage}
              members={members ?? []}
              assignedMemberIds={assigneesByChore.get(chore.id) ?? (chore.assigned_member_id ? [chore.assigned_member_id] : [])}
              frequencyLabel={chore.frequency !== "once" ? frequencyLabel(chore.frequency, chore.days_of_week) : null}
            />
          ))}
        </div>
      )}

      {canManage && (
        <Card className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">🎁 Kid Rewards</h2>
          <p className="mb-3 text-xs text-slate-400">
            What kids can redeem points for — shows up on their dashboard once they&rsquo;ve earned enough.
          </p>
          <AddRewardForm audience="kid" />
          {!!kidRewards.length && (
            <div className="mt-4 space-y-1">
              {kidRewards.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-sm text-slate-900">{r.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-500">⭐ {r.cost}</span>
                    <form action={deleteReward}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className={iconButtonClass}>Remove</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {canManage && (
        <Card className="mt-8 !bg-indigo-50">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">🔒 Adult Rewards — Private</h2>
            <span className="text-sm font-medium text-indigo-700">Your points: ⭐ {ownBalance}</span>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Just for admins/adults (you and Luke) — kid and sitter accounts never see this section at all.
          </p>
          <AddRewardForm audience="adult" />
          {!!adultRewards.length && (
            <div className="mt-4 space-y-2">
              {adultRewards.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                  <div>
                    <span className="text-sm text-slate-900">{r.name}</span>
                    <span className="ml-2 text-xs text-slate-400">⭐ {r.cost}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-32">
                      {ownPendingRewardIds.has(r.id) ? (
                        <button disabled className="w-full rounded-xl bg-slate-100 py-2 text-xs font-bold text-slate-400">
                          Waiting for approval
                        </button>
                      ) : (
                        <RedeemButton rewardId={r.id} canAfford={ownBalance >= r.cost} />
                      )}
                    </div>
                    <form action={deleteReward}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className={iconButtonClass}>Remove</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
