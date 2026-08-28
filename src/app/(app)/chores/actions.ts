"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { sendPushToMember } from "@/lib/push";

export async function addChore(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();
  const assignedMemberIds = (formData.getAll("assigned_member_id") as string[]).filter(Boolean);

  let assignedNames: string[] = [];
  if (assignedMemberIds.length) {
    const { data: memberRows } = await supabase.from("household_members").select("id, display_name").in("id", assignedMemberIds);
    assignedNames = assignedMemberIds
      .map((id) => memberRows?.find((m) => m.id === id)?.display_name)
      .filter((n): n is string => !!n);
  }

  const title = formData.get("title") as string;
  const frequency = (formData.get("frequency") as string) || "once";
  const daysOfWeek = (formData.getAll("days_of_week") as string[]).map(Number).filter((n) => !Number.isNaN(n));

  const { data: chore, error } = await supabase
    .from("chores")
    .insert({
      household_id: household.householdId,
      title,
      assigned_member_id: assignedMemberIds[0] ?? null,
      assigned_to: assignedNames.join(", ") || null,
      frequency,
      days_of_week: frequency === "weekly" && daysOfWeek.length ? daysOfWeek : null,
      points: Number(formData.get("points") || 0),
      due_date: (formData.get("due_date") as string) || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (assignedMemberIds.length) {
    const { error: assigneeError } = await supabase
      .from("chore_assignees")
      .insert(assignedMemberIds.map((memberId) => ({ household_id: household.householdId, chore_id: chore.id, member_id: memberId })));
    if (assigneeError) return { error: assigneeError.message };

    for (const memberId of assignedMemberIds) {
      await sendPushToMember(supabase, memberId, {
        title: "🧹 New chore assigned",
        body: title,
        url: "/chores",
      });
    }
  }

  revalidatePath("/chores");
  return { success: true };
}

function advanceDueDate(dateStr: string, frequency: string, daysOfWeek?: number[] | null): string {
  const d = new Date(`${dateStr}T00:00:00`);

  if (frequency === "weekly" && daysOfWeek?.length) {
    // Jump to the next date (after d) that falls on one of the selected weekdays -- e.g. Mon/
    // Wed/Fri instead of a flat +7 days. Looping up to 14 days guarantees a hit even with a
    // single selected day.
    for (let i = 1; i <= 14; i++) {
      const candidate = new Date(d);
      candidate.setDate(candidate.getDate() + i);
      if (daysOfWeek.includes(candidate.getDay())) return candidate.toISOString().slice(0, 10);
    }
  }

  switch (frequency) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      break;
  }
  return d.toISOString().slice(0, 10);
}

export async function completeChore(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();
  const id = formData.get("id") as string;

  const { data: chore, error: fetchError } = await supabase.from("chores").select("*").eq("id", id).single();
  if (fetchError) throw new Error(fetchError.message);
  if (!chore) return;
  if (chore.frequency === "once" && chore.status === "done") return; // already completed

  if (chore.frequency === "once") {
    const { error } = await supabase
      .from("chores")
      .update({ status: "done", last_completed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    // Recurring chores reset to open immediately so they reappear for the next cycle, and
    // the due date advances to the next occurrence -- otherwise the row looks unchanged
    // after marking it done, which just looks like the button didn't do anything.
    const nextDue = chore.due_date ? advanceDueDate(chore.due_date, chore.frequency, chore.days_of_week) : null;
    const { error } = await supabase
      .from("chores")
      .update({ status: "open", last_completed_at: new Date().toISOString(), due_date: nextDue })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  // Logged separately from chores.status since recurring chores don't stay "done" -- this is
  // the durable record used to total up points earned for the rewards balance. Every assignee
  // on a shared chore gets full credit, not a split -- "you both did it" is worth crediting both.
  if (chore.points > 0) {
    const { data: assignees } = await supabase.from("chore_assignees").select("member_id").eq("chore_id", chore.id);
    const memberIds = assignees?.length ? assignees.map((a) => a.member_id) : chore.assigned_member_id ? [chore.assigned_member_id] : [];

    if (memberIds.length) {
      const { error } = await supabase.from("chore_completions").insert(
        memberIds.map((memberId) => ({
          household_id: household.householdId,
          chore_id: chore.id,
          member_id: memberId,
          points: chore.points,
        }))
      );
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath("/chores");
  revalidatePath("/dashboard");
}

export async function deleteChore(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  const { error } = await supabase.from("chores").delete().eq("id", formData.get("id") as string);
  if (error) throw new Error(error.message);
  revalidatePath("/chores");
}
