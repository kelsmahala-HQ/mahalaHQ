import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type { CurrentHousehold } from "@/lib/household";
import { todayEasternDateStr } from "@/lib/chore-reminders";
import { completeChore, skipChore } from "../chores/actions";
import { availableNow, eligibleFor, upcoming } from "../chores/availability";
import { wallClockDate } from "@/lib/wall-clock";
import RedeemButton from "../chores/redeem-button";

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
      supabase.from("chore_completions").select("points, approval_status").eq("member_id", household.memberId),
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

  const earned = (completions ?? [])
    .filter((c) => c.approval_status === "approved")
    .reduce((sum, c) => sum + c.points, 0);
  const pendingPoints = (completions ?? [])
    .filter((c) => c.approval_status === "pending")
    .reduce((sum, c) => sum + c.points, 0);
  const pendingRedemptions = (redemptions ?? []).filter((r) => r.status === "pending");
  const reserved = (redemptions ?? [])
    .filter((r) => r.status === "pending" || r.status === "approved")
    .reduce((sum, r) => sum + r.cost, 0);
  const balance = earned - reserved;
  const pendingRewardIds = new Set(pendingRedemptions.map((r) => r.reward_id));

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
              <p className="text-xl font-bold">🏆 {balance}</p>
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

      {!!rewards?.length && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-bold text-slate-900">🎁 Rewards</h2>
          <div className="grid grid-cols-2 gap-3">
            {rewards.map((r) => (
              <div key={r.id} className="rounded-2xl border-2 border-teal-100 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                <p className="mb-2 mt-0.5 text-xs font-medium text-teal-700">⭐ {r.cost}</p>
                {pendingRewardIds.has(r.id) ? (
                  <button disabled className="w-full rounded-xl bg-slate-100 py-2 text-xs font-bold text-slate-400">
                    Waiting for approval
                  </button>
                ) : (
                  <RedeemButton rewardId={r.id} canAfford={balance >= r.cost} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="mb-3 text-lg font-bold text-slate-900">🧹 Your Chores</h2>
        {!openChores.length ? (
          <div className="rounded-2xl border-2 border-dashed border-yellow-300 bg-yellow-50 p-8 text-center">
            <p className="text-4xl">🎉</p>
            <p className="mt-2 font-medium text-slate-700">Nothing to do right now. Nice work!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {openChores.map((chore) => (
              <div key={chore.id} className="flex items-center justify-between rounded-2xl border-2 border-teal-100 bg-white p-4 shadow-sm">
                <div>
                  <p className="text-base font-semibold text-slate-900">{chore.title}</p>
                  <p className="text-sm text-slate-400">
                    {[
                      chore.frequency !== "once" ? chore.frequency : null,
                      chore.due_date ? `due ${chore.due_date}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {chore.points > 0 && (
                    <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-bold text-yellow-800">
                      ⭐ {chore.points}
                    </span>
                  )}
                  <form action={completeChore}>
                    <input type="hidden" name="id" value={chore.id} />
                    <button className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-bold text-white hover:bg-teal-600">
                      Done! ✅
                    </button>
                  </form>
                  <form action={skipChore}>
                    <input type="hidden" name="id" value={chore.id} />
                    <button
                      title="Only did part of it? Skip earns 0 points but clears it for now."
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-50"
                    >
                      Skip
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
        {!!upcomingChores.length && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-slate-400">⏳ Coming up</p>
            <div className="space-y-2">
              {upcomingChores.map((chore) => (
                <div key={chore.id} className="flex items-center justify-between rounded-xl bg-white/70 px-4 py-3 text-sm shadow-sm">
                  <span className="font-medium text-slate-600">{chore.title}</span>
                  <span className="text-xs text-slate-400">{chore.due_date ? `Available ${chore.due_date}` : ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
