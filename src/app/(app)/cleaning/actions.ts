"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";

function addInterval(date: Date, frequency: string): Date {
  const d = new Date(date);
  switch (frequency) {
    case "daily":
      d.setDate(d.getDate() + 1);
      return d;
    case "weekly":
      d.setDate(d.getDate() + 7);
      return d;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      return d;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      return d;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      return d;
    default:
      return d;
  }
}

export async function addCleaningTask(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();
  const assignedMemberIds = (formData.getAll("assigned_member_id") as string[]).filter(Boolean);
  const title = (formData.get("title") as string)?.trim();
  const frequency = formData.get("frequency") as string;

  if (!title) return { error: "Name the task." };
  if (!["daily", "weekly", "monthly", "quarterly", "yearly"].includes(frequency)) return { error: "Pick a frequency." };

  let assignedNames: string[] = [];
  if (assignedMemberIds.length) {
    const { data: memberRows } = await supabase.from("household_members").select("id, display_name").in("id", assignedMemberIds);
    assignedNames = assignedMemberIds
      .map((id) => memberRows?.find((m) => m.id === id)?.display_name)
      .filter((n): n is string => !!n);
  }

  const { data: task, error } = await supabase
    .from("cleaning_tasks")
    .insert({
      household_id: household.householdId,
      title,
      frequency,
      assigned_member_id: assignedMemberIds[0] ?? null,
      assigned_to: assignedNames.join(", ") || null,
      next_due_at: (formData.get("next_due_at") as string) || new Date().toISOString().slice(0, 10),
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (assignedMemberIds.length) {
    const { error: assigneeError } = await supabase
      .from("cleaning_task_assignees")
      .insert(assignedMemberIds.map((memberId) => ({ household_id: household.householdId, cleaning_task_id: task.id, member_id: memberId })));
    if (assigneeError) return { error: assigneeError.message };
  }

  revalidatePath("/cleaning");
  return { success: true };
}

export async function markCleaningTaskDone(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const frequency = formData.get("frequency") as string;
  const today = new Date();

  const nextDue = addInterval(today, frequency).toISOString().slice(0, 10);

  await supabase
    .from("cleaning_tasks")
    .update({ last_done_at: today.toISOString().slice(0, 10), next_due_at: nextDue })
    .eq("id", id);

  revalidatePath("/cleaning");
}

export async function deleteCleaningTask(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("cleaning_tasks").delete().eq("id", formData.get("id") as string);
  revalidatePath("/cleaning");
}

/** Creates a real chore from a cleaning task -- same frequency/assignee, so it shows up in
 *  Chores (with points, kid visibility, "Mark done") instead of just sitting on the Cleaning
 *  Schedule. Linked via chores.cleaning_task_id so it can't be added twice. */
export async function syncCleaningTaskToChore(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();
  const cleaningTaskId = formData.get("cleaning_task_id") as string;
  const points = Number(formData.get("points") || 0);

  const [{ data: task, error: fetchError }, { data: taskAssignees }] = await Promise.all([
    supabase.from("cleaning_tasks").select("*").eq("id", cleaningTaskId).single(),
    supabase.from("cleaning_task_assignees").select("member_id").eq("cleaning_task_id", cleaningTaskId),
  ]);
  if (fetchError || !task) return { error: fetchError?.message ?? "Task not found." };

  const memberIds = taskAssignees?.length ? taskAssignees.map((a) => a.member_id) : task.assigned_member_id ? [task.assigned_member_id] : [];

  const { data: chore, error } = await supabase
    .from("chores")
    .insert({
      household_id: household.householdId,
      title: task.title,
      assigned_member_id: memberIds[0] ?? null,
      assigned_to: task.assigned_to,
      frequency: task.frequency,
      points,
      due_date: task.next_due_at,
      cleaning_task_id: task.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (memberIds.length) {
    const { error: assigneeError } = await supabase
      .from("chore_assignees")
      .insert(memberIds.map((memberId) => ({ household_id: household.householdId, chore_id: chore.id, member_id: memberId })));
    if (assigneeError) return { error: assigneeError.message };
  }

  revalidatePath("/cleaning");
  revalidatePath("/chores");
  return { success: true };
}
