import { createClient } from "@/lib/supabase/server";
import { requireAdult } from "@/lib/household";
import { Card, EmptyState, PageHeader, buttonClass, iconButtonClass, inputClass } from "@/components/ui";
import { addTask, deleteTask, markDone } from "./actions";

export default async function MaintenancePage() {
  const household = await requireAdult();
  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("maintenance_tasks")
    .select("*")
    .eq("household_id", household.householdId)
    .order("next_due_at", { nullsFirst: false });

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader title="House Maintenance" subtitle="Recurring upkeep — filters, gutters, HVAC, and more." />

      <Card className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Add a task</h2>
        <form action={addTask} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input name="title" required placeholder="Task (e.g. Replace HVAC filter)" className={inputClass} />
          <input name="category" placeholder="Category (e.g. HVAC)" className={inputClass} />
          <input
            name="frequency_days"
            type="number"
            min={1}
            placeholder="Repeats every N days (optional)"
            className={inputClass}
          />
          <input name="next_due_at" type="date" placeholder="Next due" className={inputClass} />
          <textarea name="notes" placeholder="Notes" className={`${inputClass} sm:col-span-2`} rows={2} />
          <button type="submit" className={`${buttonClass} sm:col-span-2`}>
            Add task
          </button>
        </form>
      </Card>

      {!tasks?.length ? (
        <EmptyState message="No maintenance tasks yet — add one above." />
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const overdue = task.next_due_at && task.next_due_at < todayStr;
            return (
              <Card key={task.id} className="flex items-center justify-between !p-4">
                <div>
                  <p className="font-medium text-slate-900">{task.title}</p>
                  <p className={`text-sm ${overdue ? "font-medium text-red-600" : "text-slate-500"}`}>
                    {[
                      task.category,
                      task.frequency_days ? `every ${task.frequency_days}d` : null,
                      task.next_due_at ? `${overdue ? "overdue since" : "due"} ${task.next_due_at}` : null,
                      task.last_done_at ? `last done ${task.last_done_at}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {task.notes && <p className="text-xs text-slate-400">{task.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <form action={markDone}>
                    <input type="hidden" name="id" value={task.id} />
                    <input type="hidden" name="frequency_days" value={task.frequency_days ?? ""} />
                    <button className="rounded-lg bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100">
                      Mark done
                    </button>
                  </form>
                  <form action={deleteTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <button className={iconButtonClass}>Remove</button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
