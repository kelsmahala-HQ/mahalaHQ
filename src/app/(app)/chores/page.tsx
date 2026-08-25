import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { Card, EmptyState, PageHeader, iconButtonClass } from "@/components/ui";
import { completeChore, deleteChore } from "./actions";
import { approveRedemption, denyRedemption, deleteReward } from "./rewards-actions";
import AddChoreForm from "./add-chore-form";
import AddRewardForm from "./add-reward-form";

export default async function ChoresPage() {
  const household = await requireHousehold();
  const supabase = await createClient();
  const isKid = household.role === "kid";
  const canManage = household.role === "admin" || household.role === "adult";

  const [{ data: members }, choresQuery, { data: rewards }, { data: pendingRedemptions }] = await Promise.all([
    supabase.from("household_members").select("id, display_name").eq("household_id", household.householdId).order("display_name"),
    (() => {
      let query = supabase
        .from("chores")
        .select("*")
        .eq("household_id", household.householdId)
        .order("status")
        .order("due_date", { nullsFirst: false });
      if (isKid) query = query.eq("assigned_member_id", household.memberId);
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

  return (
    <div>
      <PageHeader
        title={isKid ? "Your Chores" : "Chores"}
        subtitle={isKid ? "Everything assigned to you." : "Assign tasks and track who's done what."}
      />

      {canManage && (
        <Card className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Add a chore</h2>
          <AddChoreForm members={members ?? []} />
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

      {!chores?.length ? (
        <EmptyState message={isKid ? "Nothing assigned to you right now. 🎉" : "No chores yet — add one above."} />
      ) : (
        <div className="space-y-2">
          {chores.map((chore) => (
            <Card key={chore.id} className="flex items-center justify-between !p-4">
              <div>
                <p className={`font-medium ${chore.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>
                  {chore.title}
                  {chore.points > 0 && (
                    <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">
                      ⭐ {chore.points} pts
                    </span>
                  )}
                </p>
                <p className="text-sm text-slate-500">
                  {[
                    !isKid ? chore.assigned_to : null,
                    chore.frequency !== "once" ? chore.frequency : null,
                    chore.due_date ? `due ${chore.due_date}` : null,
                    chore.last_completed_at ? `last done ${new Date(chore.last_completed_at).toLocaleDateString()}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <form action={completeChore}>
                  <input type="hidden" name="id" value={chore.id} />
                  <input type="hidden" name="frequency" value={chore.frequency} />
                  <button className="rounded-lg bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100">
                    {chore.status === "done" ? "Done ✓" : "Mark done"}
                  </button>
                </form>
                {canManage && (
                  <form action={deleteChore}>
                    <input type="hidden" name="id" value={chore.id} />
                    <button className={iconButtonClass}>Remove</button>
                  </form>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {canManage && (
        <Card className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">🎁 Rewards</h2>
          <p className="mb-3 text-xs text-slate-400">
            What kids can redeem points for — shows up on their dashboard once they&rsquo;ve earned enough.
          </p>
          <AddRewardForm />
          {!!rewards?.length && (
            <div className="mt-4 space-y-1">
              {rewards.map((r) => (
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
    </div>
  );
}
