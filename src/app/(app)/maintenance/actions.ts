"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";

export async function addTask(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();
  const frequencyDays = formData.get("frequency_days");

  await supabase.from("maintenance_tasks").insert({
    household_id: household.householdId,
    title: formData.get("title") as string,
    category: formData.get("category") as string,
    frequency_days: frequencyDays ? Number(frequencyDays) : null,
    next_due_at: (formData.get("next_due_at") as string) || null,
    notes: formData.get("notes") as string,
  });

  revalidatePath("/maintenance");
}

export async function markDone(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const frequencyDays = formData.get("frequency_days");
  const today = new Date();

  const nextDue = frequencyDays
    ? new Date(today.getTime() + Number(frequencyDays) * 86400000).toISOString().slice(0, 10)
    : null;

  await supabase
    .from("maintenance_tasks")
    .update({ last_done_at: today.toISOString().slice(0, 10), next_due_at: nextDue })
    .eq("id", id);

  revalidatePath("/maintenance");
}

export async function deleteTask(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("maintenance_tasks").delete().eq("id", formData.get("id") as string);
  revalidatePath("/maintenance");
}
