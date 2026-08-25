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
  const assignedMemberId = (formData.get("assigned_member_id") as string) || null;
  const title = (formData.get("title") as string)?.trim();
  const frequency = formData.get("frequency") as string;

  if (!title) return { error: "Name the task." };
  if (!["daily", "weekly", "monthly", "quarterly", "yearly"].includes(frequency)) return { error: "Pick a frequency." };

  let assignedTo: string | null = null;
  if (assignedMemberId) {
    const { data: member } = await supabase.from("household_members").select("display_name").eq("id", assignedMemberId).maybeSingle();
    assignedTo = member?.display_name ?? null;
  }

  const { error } = await supabase.from("cleaning_tasks").insert({
    household_id: household.householdId,
    title,
    frequency,
    assigned_member_id: assignedMemberId,
    assigned_to: assignedTo,
    next_due_at: (formData.get("next_due_at") as string) || new Date().toISOString().slice(0, 10),
    notes: (formData.get("notes") as string) || null,
  });

  if (error) return { error: error.message };
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

  const { data: task, error: fetchError } = await supabase.from("cleaning_tasks").select("*").eq("id", cleaningTaskId).single();
  if (fetchError || !task) return { error: fetchError?.message ?? "Task not found." };

  const { error } = await supabase.from("chores").insert({
    household_id: household.householdId,
    title: task.title,
    assigned_member_id: task.assigned_member_id,
    assigned_to: task.assigned_to,
    frequency: task.frequency,
    points,
    due_date: task.next_due_at,
    cleaning_task_id: task.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/cleaning");
  revalidatePath("/chores");
  return { success: true };
}
