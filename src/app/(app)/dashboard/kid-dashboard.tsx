import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type { CurrentHousehold } from "@/lib/household";
import { todayEasternDateStr } from "@/lib/chore-reminders";
import { availableNow, eligibleFor, upcoming } from "../chores/availability";
import { wallClockDate } from "@/lib/wall-clock";
import RedeemButton from "../chores/redeem-button";
import { GRADE_RULES, buildProgress, formatMoney, groundedStatus, weeklyStanding } from "@/lib/grades";
import { loadPlanState } from "@/lib/grades-data";
import { balanceFor } from "@/lib/points";

/**
 * The kid's home screen: a snapshot, with Chores and Grades each on their own page. Rewards and
 * what's coming up on the calendar stay here.
 */
export default async function KidDashboard({ household }: { household: CurrentHousehold }) {
  const supabase = await createClient();
  const todayStr = todayEasternDateStr();

  const [{ data: allChores }, { data: eligibilityRows }, { data: completions }, { data: rewards }, { data: redemptions }] =
    await Promise.all([
      supabase
        .from("chores")
        .select("*")
        .eq("household_id", household.householdId)
        .order("due_date", { nullsFirst: false }),
      supabase.from("chore_eligibility").select("chore_id, member_id").eq("household_id", household.householdId),
      supabase.from("chore_completions").select("points, approval_status, kind").eq("member_id", household.memberId),
      supabase.from("rewards").select("*").eq("household_id", household.householdId).eq("audience", "kid").order("cost"),
      supabase.from("reward_redemptions").select("*").eq("member_id", household.memberId).order("requested_at", { ascending: false }),
    ]);

  const eligibleByChore = new Map<string, string[]>();
  for (const row of eligibilityRows ?? []) {
    if (!eligibleByChore.has(row.chore_id)) eligibleByChore.set(row.chore_id, []);
    eligibleByChore.get(row.chore_id)!.push(row.member_id);
  }

  const myChores = (allChores ?? []).filter((c) => eligibleFor(eligibleByChore.get(c.id), household.memberId, false));
  const openChores = myChores.filter((c) => availableNow(c, todayStr));
  const upcomingChores = myChores.filter((c) => upcoming(c, todayStr));
  const availablePoints = openChores.reduce((sum, c) => sum + (c.points ?? 0), 0);

  const choreBalance = balanceFor("chores", completions ?? [], redemptions ?? []);
  const earned = (completions ?? [])
    .filter((c) => c.approval_status === "approved" && c.kind !== "grade")
    .reduce((sum, c) => sum + c.points, 0);
  const pendingPoints = (completions ?? [])
    .filter((c) => c.approval_status === "pending")
    .reduce((sum, c) => sum + c.points, 0);
  const pendingRedemptions = (redemptions ?? []).filter((r) => r.status === "pending");
  const choreRewards = (rewards ?? []).filter((r) => r.source !== "grades");
  const pendingRewardIds = new Set(pendingRedemptions.map((r) => r.reward_id));

  // A quick read on their grades for the summary card; the full picture is on the Grades page.
  const { data: gradePlan } = await supabase
    .from("grade_plans")
    .select("*")
    .eq("household_id", household.householdId)
    .eq("member_id", household.memberId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  const gradeState = gradePlan ? await loadPlanState(supabase, gradePlan.id) : null;
  const gradeProgress = gradeState ? buildProgress(gradeState.baseline, gradeState.latest) : [];
  const gradePace = gradePlan ? weeklyStanding(gradeProgress, 0, gradePlan.weekly_cap ?? GRADE_RULES.weeklyCap).dollars : 0;
  const gradeStatus = groundedStatus(gradeProgress);

  const now = new Date();
  const { data: events } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("household_id", household.householdId)
    .gte("start_at", now.toISOString())
    .lte("start_at", new Date(now.getTime() + 7 * 86400000).toISOString())
    .order("start_at")
    .limit(5);

  return (
    <div>
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 p-6 text-white">
        <p className="text-2xl font-bold">Hey {household.displayName}! 👋</p>
        <p className="mt-1 text-teal-50">
          {openChores.length === 0
            ? "You're all caught up — awesome job! 🎉"
            : `You have ${openChores.length} chore${openChores.length === 1 ? "" : "s"} waiting — go earn some stars!`}
        </p>
        {(availablePoints > 0 || earned > 0 || pendingPoints > 0) && (
          <div className="mt-4 flex flex-wrap gap-4">
            <div className="rounded-xl bg-white/15 px-4 py-2">
              <p className="text-xs uppercase tracking-wide text-teal-50">Up for grabs</p>
              <p className="text-xl font-bold">⭐ {availablePoints}</p>
            </div>
            <div className="rounded-xl bg-white/15 px-4 py-2">
              <p className="text-xs uppercase tracking-wide text-teal-50">Balance</p>
              <p className="text-xl font-bold">🏆 {choreBalance}</p>
            </div>

            {pendingPoints > 0 && (
              <div className="rounded-xl bg-white/15 px-4 py-2">
                <p className="text-xs uppercase tracking-wide text-teal-50">Waiting for a grown-up</p>
                <p className="text-xl font-bold">⏳ {pendingPoints}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/chores"
          className="rounded-2xl border-2 border-teal-100 bg-white p-4 shadow-sm transition hover:border-teal-300"
        >
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-slate-900">🧹 Chores</h2>
            <span className="text-sm font-medium text-teal-600">Open →</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {openChores.length === 0
              ? "Nothing to do right now. Nice work!"
              : `${openChores.length} waiting · ⭐ ${availablePoints} up for grabs`}
          </p>
          {upcomingChores.length > 0 && (
            <p className="mt-0.5 text-xs text-slate-400">
              {upcomingChores.length} more coming up
            </p>
          )}
        </Link>

        {gradePlan && gradeProgress.length > 0 && (
          <Link
            href="/grades"
            className={`rounded-2xl border-2 bg-white p-4 shadow-sm transition ${
              gradeStatus.grounded ? "border-red-200 hover:border-red-300" : "border-teal-100 hover:border-teal-300"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold text-slate-900">📚 Grades</h2>
              <span className="text-sm font-medium text-teal-600">Open →</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{formatMoney(gradePace)} a week at these grades</p>
            {gradeStatus.grounded ? (
              <p className="mt-0.5 text-xs font-medium text-red-700">You&rsquo;re staying in for now</p>
            ) : gradeStatus.count >= gradeStatus.limit ? (
              <p className="mt-0.5 text-xs font-medium text-amber-700">At the limit — one more and you&rsquo;re staying in</p>
            ) : (
              <p className="mt-0.5 text-xs text-slate-400">
                {gradeProgress.length} classes · {gradeStatus.count} below a C-
              </p>
            )}
          </Link>
        )}
      </div>

      {!!choreRewards.length && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-bold text-slate-900">🎁 Rewards</h2>
          <div className="grid grid-cols-2 gap-3">
            {choreRewards.map((r) => (
              <div key={r.id} className="rounded-2xl border-2 border-teal-100 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                <p className="mb-2 mt-0.5 text-xs font-medium text-teal-700">
                  ⭐ {r.cost}
                  {r.cash_value ? ` · 💵 $${r.cash_value}` : ""}
                </p>
                {pendingRewardIds.has(r.id) ? (
                  <button disabled className="w-full rounded-xl bg-slate-100 py-2 text-xs font-bold text-slate-400">
                    Waiting for approval
                  </button>
                ) : (
                  <RedeemButton rewardId={r.id} canAfford={choreBalance >= r.cost} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!!events?.length && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">📅 Coming Up</h2>
            <Link href="/calendar" className="text-sm font-medium text-teal-600 hover:underline">
              See calendar
            </Link>
          </div>
          <div className="space-y-2">
            {events.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                <span className="text-sm text-slate-400">
                  {format(wallClockDate(e.start_at), e.all_day ? "EEE, MMM d" : "EEE, MMM d 'at' h:mma")}
                </span>
                <span className="text-sm font-medium text-slate-900">{e.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
