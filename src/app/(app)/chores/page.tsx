import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { Card, EmptyState, PageHeader, iconButtonClass } from "@/components/ui";
import { completeChore, deleteChore } from "./actions";
import AddChoreForm from "./add-chore-form";

export default async function ChoresPage() {
  const household = await requireHousehold();
  const supabase = await createClient();
  const isKid = household.role === "kid";
  const canManage = household.role === "admin" || household.role === "adult";

  const [{ data: members }, choresQuery] = await Promise.all([
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
  ]);
  const { data: chores } = choresQuery;

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
    </div>
  );
}
