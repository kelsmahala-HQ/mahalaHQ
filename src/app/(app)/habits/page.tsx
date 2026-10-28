import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { todayEasternDateStr } from "@/lib/chore-reminders";
import { Card, CollapsibleCard, EmptyState, PageHeader } from "@/components/ui";
import { HABIT_LOOKBACK_DAYS, addDaysStr, habitStats } from "@/lib/habits";
import { daysOfWeekLabel } from "@/lib/weekdays";
import HabitCard from "./habit-card";
import HabitForm from "./habit-form";
import { setHabitArchived } from "./actions";

export default async function HabitsPage() {
  const household = await requireHousehold();
  if (household.role === "sitter") redirect("/dashboard");
  const supabase = await createClient();
  const todayStr = todayEasternDateStr();

  // Private to the signed-in person: the database only ever returns your own habits.
  const { data: habits, error } = await supabase
    .from("habits")
    .select("*")
    .eq("member_id", household.memberId)
    .order("created_at");

  if (error) {
    return (
      <div>
        <PageHeader title="Habits" subtitle="Small things, done every day." />
        <EmptyState message="The habit tracker isn't set up yet. The new database script needs to be run once first." />
      </div>
    );
  }

  const habitIds = (habits ?? []).map((h) => h.id);
  const { data: checkins } = habitIds.length
    ? await supabase
        .from("habit_checkins")
        .select("habit_id, date")
        .in("habit_id", habitIds)
        .gte("date", addDaysStr(todayStr, -HABIT_LOOKBACK_DAYS))
    : { data: [] as { habit_id: string; date: string }[] };

  const doneByHabit = new Map<string, Set<string>>();
  for (const c of checkins ?? []) {
    if (!doneByHabit.has(c.habit_id)) doneByHabit.set(c.habit_id, new Set());
    doneByHabit.get(c.habit_id)!.add(c.date as string);
  }

  const active = (habits ?? [])
    .filter((h) => !h.archived)
    .map((h) => ({ habit: h, stats: habitStats(h, doneByHabit.get(h.id) ?? new Set(), todayStr) }));
  const archived = (habits ?? []).filter((h) => h.archived);

  // Due today first, then the rest; keeps creation order within each group.
  active.sort((a, z) => Number(z.stats.dueToday) - Number(a.stats.dueToday));

  const dueToday = active.filter((a) => a.stats.dueToday);
  const doneCount = dueToday.filter((a) => a.stats.doneToday).length;
  const pct = dueToday.length ? Math.round((doneCount / dueToday.length) * 100) : 0;

  return (
    <div>
      <PageHeader title="Habits" subtitle="Small things, done every day. Only you can see yours." />

      {!!dueToday.length && (
        <Card className="mb-6">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Today</h2>
            <span className="text-sm font-medium text-teal-700">
              {doneCount} of {dueToday.length} done
              {doneCount === dueToday.length && " 🎉"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </Card>
      )}

      <CollapsibleCard title="Add a habit" className="mb-6">
        <HabitForm />
      </CollapsibleCard>

      {!active.length ? (
        <EmptyState message="No habits yet. Add one above — start with just one or two." />
      ) : (
        <div className="space-y-3">
          {active.map(({ habit, stats }) => (
            <HabitCard
              key={`${habit.id}-${stats.week.map((c) => (c.done ? 1 : 0)).join("")}`}
              habit={{ id: habit.id, name: habit.name, emoji: habit.emoji, days_of_week: habit.days_of_week }}
              week={stats.week}
              streak={stats.streak}
              best={stats.best}
              rate30={stats.rate30}
              dueToday={stats.dueToday}
            />
          ))}
        </div>
      )}

      {!!archived.length && (
        <CollapsibleCard title="Archived" className="mt-8">
          <div className="space-y-1">
            {archived.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-700">
                  {h.emoji && <span className="mr-2">{h.emoji}</span>}
                  {h.name}
                  <span className="ml-2 text-xs text-slate-400">{daysOfWeekLabel(h.days_of_week) ?? "Every day"}</span>
                </span>
                <form action={setHabitArchived}>
                  <input type="hidden" name="id" value={h.id} />
                  <input type="hidden" name="archived" value="false" />
                  <button className="text-xs font-medium text-teal-600 hover:text-teal-500">Restore</button>
                </form>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      )}
    </div>
  );
}
