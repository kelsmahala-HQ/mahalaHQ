"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { sendPushToMember } from "@/lib/push";

export async function addChore(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();
  const assignedMemberId = (formData.get("assigned_member_id") as string) || null;

  let assignedTo: string | null = null;
  if (assignedMemberId) {
    const { data: member } = await supabase
      .from("household_members")
      .select("display_name")
      .eq("id", assignedMemberId)
      .maybeSingle();
    assignedTo = member?.display_name ?? null;
  }

  const title = formData.get("title") as string;

  const { error } = await supabase.from("chores").insert({
    household_id: household.householdId,
    title,
    assigned_member_id: assignedMemberId,
    assigned_to: assignedTo,
    frequency: (formData.get("frequency") as string) || "once",
    points: Number(formData.get("points") || 0),
    due_date: (formData.get("due_date") as string) || null,
  });

  if (error) return { error: error.message };

  if (assignedMemberId) {
    await sendPushToMember(supabase, assignedMemberId, {
      title: "🧹 New chore assigned",
      body: title,
      url: "/chores",
    });
  }

  revalidatePath("/chores");
  return { success: true };
}

function advanceDueDate(dateStr: string, frequency: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
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
    const nextDue = chore.due_date ? advanceDueDate(chore.due_date, chore.frequency) : null;
    const { error } = await supabase
      .from("chores")
      .update({ status: "open", last_completed_at: new Date().toISOString(), due_date: nextDue })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  // Logged separately from chores.status since recurring chores don't stay "done" -- this is
  // the durable record used to total up points earned for the rewards balance.
  if (chore.points > 0 && chore.assigned_member_id) {
    const { error } = await supabase.from("chore_completions").insert({
      household_id: household.householdId,
      chore_id: chore.id,
      member_id: chore.assigned_member_id,
      points: chore.points,
    });
    if (error) throw new Error(error.message);
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
