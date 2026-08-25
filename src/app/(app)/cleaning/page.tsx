import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { Card, CollapsibleCard, EmptyState, PageHeader, iconButtonClass } from "@/components/ui";
import { deleteCleaningTask, markCleaningTaskDone } from "./actions";
import AddCleaningTaskForm from "./add-cleaning-task-form";
import SyncToChoreForm from "./sync-to-chore-form";

const TIERS = [
  { value: "daily", label: "Daily", icon: "☀️" },
  { value: "weekly", label: "Weekly", icon: "📆" },
  { value: "monthly", label: "Monthly", icon: "🗓️" },
  { value: "quarterly", label: "Quarterly", icon: "📅" },
  { value: "yearly", label: "Yearly", icon: "🎯" },
] as const;

export default async function CleaningPage() {
  const household = await requireHousehold();
  const supabase = await createClient();

  const [{ data: tasks }, { data: members }, { data: linkedChores }] = await Promise.all([
    supabase.from("cleaning_tasks").select("*").eq("household_id", household.householdId).order("next_due_at", { nullsFirst: false }),
    supabase.from("household_members").select("id, display_name").eq("household_id", household.householdId).order("display_name"),
    supabase.from("chores").select("cleaning_task_id").eq("household_id", household.householdId).not("cleaning_task_id", "is", null),
  ]);

  const taskIdsInChores = new Set((linkedChores ?? []).map((c) => c.cleaning_task_id));
  const todayStr = new Date().toISOString().slice(0, 10);
  const tasksByTier = new Map<string, NonNullable<typeof tasks>>();
  for (const t of tasks ?? []) {
    if (!tasksByTier.has(t.frequency)) tasksByTier.set(t.frequency, []);
    tasksByTier.get(t.frequency)!.push(t);
  }

  return (
    <div>
      <PageHeader title="Cleaning Schedule" subtitle="Recurring cleaning tasks, grouped by how often they need doing." />

      <CollapsibleCard title="Add a task" className="mb-8">
        <AddCleaningTaskForm members={members ?? []} />
      </CollapsibleCard>

      {!tasks?.length ? (
        <EmptyState message="No cleaning tasks yet — add one above." />
      ) : (
        <div className="space-y-8">
          {TIERS.map((tier) => {
            const tierTasks = tasksByTier.get(tier.value) ?? [];
            if (!tierTasks.length) return null;
            return (
              <div key={tier.value}>
                <h2 className="mb-3 text-sm font-semibold text-slate-700">
                  {tier.icon} {tier.label}
                </h2>
                <div className="space-y-2">
                  {tierTasks.map((task) => {
                    const overdue = task.next_due_at && task.next_due_at < todayStr;
                    return (
                      <Card key={task.id} className="flex items-center justify-between !p-4">
                        <div>
                          <p className="font-medium text-slate-900">{task.title}</p>
                          <p className={`text-sm ${overdue ? "font-medium text-red-600" : "text-slate-500"}`}>
                            {[
                              task.assigned_to,
                              task.next_due_at ? `${overdue ? "overdue since" : "due"} ${task.next_due_at}` : null,
                              task.last_done_at ? `last done ${task.last_done_at}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {task.notes && <p className="text-xs text-slate-400">{task.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          {taskIdsInChores.has(task.id) ? (
                            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">✓ In Chores</span>
                          ) : (
                            <SyncToChoreForm cleaningTaskId={task.id} />
                          )}
                          <form action={markCleaningTaskDone}>
                            <input type="hidden" name="id" value={task.id} />
                            <input type="hidden" name="frequency" value={task.frequency} />
                            <button className="rounded-lg bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100">
                              Mark done
                            </button>
                          </form>
                          <form action={deleteCleaningTask}>
                            <input type="hidden" name="id" value={task.id} />
                            <button className={iconButtonClass}>Remove</button>
                          </form>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
