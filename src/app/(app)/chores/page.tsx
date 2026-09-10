import { addDays, format, formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { todayEasternDateStr } from "@/lib/chore-reminders";
import { Card, CollapsibleCard, EmptyState, PageHeader, iconButtonClass } from "@/components/ui";
import { daysOfWeekLabel } from "@/lib/weekdays";
import { availableNow, eligibleFor, upcoming } from "./availability";
import {
  approveAllChoreCompletions,
  approveChoreCompletion,
  rejectChoreCompletion,
} from "./actions";
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
  const todayStr = todayEasternDateStr();

  const [{ data: members }, { data: chores }, { data: rewards }, { data: pendingRedemptions }, { data: eligibilityRows }] =
    await Promise.all([
      supabase.from("household_members").select("id, display_name").eq("household_id", household.householdId).order("display_name"),
      supabase
        .from("chores")
        .select("*")
        .eq("household_id", household.householdId)
        .order("status")
        .order("due_date", { nullsFirst: false }),
      canManage ? supabase.from("rewards").select("*").eq("household_id", household.householdId).order("cost") : Promise.resolve({ data: [] }),
      canManage
        ? supabase
            .from("reward_redemptions")
            .select("*")
            .eq("household_id", household.householdId)
            .eq("status", "pending")
            .order("requested_at")
        : Promise.resolve({ data: [] }),
      supabase.from("chore_eligibility").select("chore_id, member_id").eq("household_id", household.householdId),
    ]);

  const memberNameById = new Map((members ?? []).map((m) => [m.id, m.display_name]));

  // chore_id -> members explicitly allowed to claim it. No entry (or empty) = everyone.
  const eligibleByChore = new Map<string, string[]>();
  for (const row of eligibilityRows ?? []) {
    if (!eligibleByChore.has(row.chore_id)) eligibleByChore.set(row.chore_id, []);
    eligibleByChore.get(row.chore_id)!.push(row.member_id);
  }

  const visibleChores = (chores ?? []).filter((c) => eligibleFor(eligibleByChore.get(c.id), household.memberId, canManage));
  const availableChores = visibleChores.filter((c) => availableNow(c, todayStr));
  const upcomingChores = visibleChores.filter(
    (c) => upcoming(c, todayStr) || (canManage && c.frequency === "once" && c.status === "done")
  );

  const kidRewards = (rewards ?? []).filter((r) => r.audience !== "adult");
  const adultRewards = (rewards ?? []).filter((r) => r.audience === "adult");
  const ownPendingRewardIds = new Set(
    (pendingRedemptions ?? []).filter((r) => r.member_id === household.memberId).map((r) => r.reward_id)
  );

  // Everyone's point standing (admin/adult view). Balance = approved chore points earned minus
  // points already reserved by a pending or approved reward redemption -- same math the kid
  // dashboard and the redemption check use. The signed-in adult's own balance falls out of this
  // too, for the private Adult Rewards card.
  const [{ data: allCompletions }, { data: allReserved }] = canManage
    ? await Promise.all([
        supabase
          .from("chore_completions")
          .select("member_id, points, approval_status")
          .eq("household_id", household.householdId),
        supabase
          .from("reward_redemptions")
          .select("member_id, cost")
          .eq("household_id", household.householdId)
          .in("status", ["pending", "approved"]),
      ])
    : [{ data: [] as { member_id: string; points: number; approval_status: string }[] }, { data: [] as { member_id: string; cost: number }[] }];

  const pointsByMember = new Map<string, { earned: number; pending: number; reserved: number }>();
  const bucket = (id: string) => {
    if (!pointsByMember.has(id)) pointsByMember.set(id, { earned: 0, pending: 0, reserved: 0 });
    return pointsByMember.get(id)!;
  };
  for (const c of allCompletions ?? []) {
    if (c.approval_status === "approved") bucket(c.member_id).earned += c.points;
    else if (c.approval_status === "pending") bucket(c.member_id).pending += c.points;
  }
  for (const r of allReserved ?? []) bucket(r.member_id).reserved += r.cost;

  const standings = (members ?? [])
    .map((m) => {
      const b = pointsByMember.get(m.id) ?? { earned: 0, pending: 0, reserved: 0 };
      return { id: m.id, name: m.display_name, balance: b.earned - b.reserved, pending: b.pending };
    })
    .sort((a, z) => z.balance - a.balance || a.name.localeCompare(z.name));

  const ownBalance = standings.find((s) => s.id === household.memberId)?.balance ?? 0;

  // Kid chore points waiting on a parent (admin view), and the activity log.
  const [{ data: pendingCompletions }, { data: activity }] = await Promise.all([
    canManage
      ? supabase
          .from("chore_completions")
          .select("*")
          .eq("household_id", household.householdId)
          .eq("approval_status", "pending")
          .eq("kind", "completed")
          .order("completed_at")
      : Promise.resolve({ data: [] as ChoreCompletion[] }),
    (() => {
      let q = supabase
        .from("chore_completions")
        .select("*")
        .eq("household_id", household.householdId)
        .order("completed_at", { ascending: false })
        .limit(50);
      if (!canManage) q = q.eq("member_id", household.memberId);
      return q;
    })(),
  ]);

  const choreIds = visibleChores.map((c) => c.id);
  const { data: assigneeRows } = choreIds.length
    ? await supabase.from("chore_assignees").select("chore_id, member_id").in("chore_id", choreIds)
    : { data: [] as { chore_id: string; member_id: string }[] };
  const assigneesByChore = new Map<string, string[]>();
  for (const row of assigneeRows ?? []) {
    if (!assigneesByChore.has(row.chore_id)) assigneesByChore.set(row.chore_id, []);
    assigneesByChore.get(row.chore_id)!.push(row.member_id);
  }

  function renderChore(chore: (typeof visibleChores)[number], mode: "available" | "upcoming") {
    return (
      <ChoreRow
        key={chore.id}
        chore={chore}
        due={chore.status === "done" ? null : dueStatus(chore.due_date, todayStr)}
        isKid={isKid}
        canManage={canManage}
        members={members ?? []}
        assignedMemberIds={assigneesByChore.get(chore.id) ?? (chore.assigned_member_id ? [chore.assigned_member_id] : [])}
        eligibleMemberIds={eligibleByChore.get(chore.id) ?? []}
        frequencyLabel={chore.frequency !== "once" ? frequencyLabel(chore.frequency, chore.days_of_week) : null}
        mode={mode}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={isKid ? "Your Chores" : "Chores"}
        subtitle={isKid ? "Everything you can do right now." : "Assign tasks and track who's done what."}
      />

      {canManage && (
        <CollapsibleCard title="Add a chore" className="mb-8">
          <AddChoreForm members={members ?? []} />
        </CollapsibleCard>
      )}

      {canManage && !!pendingCompletions?.length && (
        <Card className="mb-8 !bg-amber-50">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">✅ Chore points waiting for your approval</h2>
            {pendingCompletions.length > 1 && (
              <form action={approveAllChoreCompletions}>
                <button className="rounded-lg bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700">
                  Approve all
                </button>
              </form>
            )}
          </div>
          <div className="space-y-2">
            {pendingCompletions.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                <p className="text-sm text-slate-900">
                  <span className="font-medium">{c.member_name ?? memberNameById.get(c.member_id) ?? "Someone"}</span> did{" "}
                  <span className="font-medium">{c.chore_title ?? "a chore"}</span>{" "}
                  <span className="text-slate-400">
                    (⭐ {c.points} · {formatDistanceToNow(new Date(c.completed_at), { addSuffix: true })})
                  </span>
                </p>
                <div className="flex gap-2">
                  <form action={approveChoreCompletion}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="rounded-lg bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100">
                      Approve
                    </button>
                  </form>
                  <form action={rejectChoreCompletion}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="rounded-lg bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Card>
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

      {!availableChores.length ? (
        <EmptyState
          message={
            isKid ? "Nothing to do right now. 🎉" : "Nothing available right now — add a chore or check Upcoming below."
          }
        />
      ) : (
        <div className="space-y-2">{availableChores.map((chore) => renderChore(chore, "available"))}</div>
      )}

      {!!upcomingChores.length && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-slate-500">⏳ Upcoming</h2>
          <div className="space-y-2">{upcomingChores.map((chore) => renderChore(chore, "upcoming"))}</div>
        </div>
      )}

      {canManage && !!standings.length && (
        <Card className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">⭐ Points by person</h2>
          <div className="space-y-1">
            {standings.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-sm font-medium text-slate-900">{s.name}</span>
                <span className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-slate-700">🏆 {s.balance}</span>
                  {s.pending > 0 && <span className="text-xs text-amber-600">+{s.pending} pending</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Balance = approved chore points earned, minus points already promised to a reward that&rsquo;s been
            requested or approved.
          </p>
        </Card>
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
            <div className="mt-4 grid grid-cols-2 gap-3">
              {adultRewards.map((r) => (
                <div key={r.id} className="relative rounded-2xl border-2 border-indigo-100 bg-white p-4 shadow-sm">
                  <form action={deleteReward} className="absolute right-2 top-2">
                    <input type="hidden" name="id" value={r.id} />
                    <button title="Remove reward" className="text-sm leading-none text-slate-300 hover:text-red-500">
                      ×
                    </button>
                  </form>
                  <p className="pr-4 text-sm font-semibold text-slate-900">{r.name}</p>
                  <p className="mb-2 mt-0.5 text-xs font-medium text-indigo-700">⭐ {r.cost}</p>
                  {ownPendingRewardIds.has(r.id) ? (
                    <button disabled className="w-full rounded-xl bg-slate-100 py-2 text-xs font-bold text-slate-400">
                      Waiting for approval
                    </button>
                  ) : (
                    <RedeemButton rewardId={r.id} canAfford={ownBalance >= r.cost} />
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {!!activity?.length && (
        <CollapsibleCard title="📋 Chore activity" className="mt-8">
          <div className="space-y-1">
            {activity.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-900">
                  <span className="font-medium">{c.member_name ?? memberNameById.get(c.member_id) ?? "Someone"}</span>{" "}
                  {c.kind === "skipped" ? "skipped" : "did"} {c.chore_title ?? "a chore"}
                </span>
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  {c.kind === "skipped" ? (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-600">Skipped · 0 pts</span>
                  ) : (
                    <span className="text-slate-500">⭐ {c.points}</span>
                  )}
                  {c.approval_status === "pending" && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">Pending</span>
                  )}
                  {c.approval_status === "rejected" && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">Rejected</span>
                  )}
                  <span>{format(new Date(c.completed_at), "MMM d, h:mma")}</span>
                </span>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      )}
    </div>
  );
}

type ChoreCompletion = {
  id: string;
  member_id: string;
  member_name: string | null;
  chore_title: string | null;
  points: number;
  kind: "completed" | "skipped";
  approval_status: "approved" | "pending" | "rejected";
  completed_at: string;
};
