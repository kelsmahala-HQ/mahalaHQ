"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";

export async function addChore(formData: FormData) {
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

  await supabase.from("chores").insert({
    household_id: household.householdId,
    title: formData.get("title") as string,
    assigned_member_id: assignedMemberId,
    assigned_to: assignedTo,
    frequency: (formData.get("frequency") as string) || "once",
    points: Number(formData.get("points") || 0),
    due_date: (formData.get("due_date") as string) || null,
  });

  revalidatePath("/chores");
}

export async function completeChore(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const frequency = formData.get("frequency") as string;

  if (frequency === "once") {
    await supabase
      .from("chores")
      .update({ status: "done", last_completed_at: new Date().toISOString() })
      .eq("id", id);
  } else {
    // Recurring chores reset to open immediately so they reappear for the next cycle.
    await supabase
      .from("chores")
      .update({ status: "open", last_completed_at: new Date().toISOString() })
      .eq("id", id);
  }

  revalidatePath("/chores");
}

export async function deleteChore(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("chores").delete().eq("id", formData.get("id") as string);
  revalidatePath("/chores");
}
