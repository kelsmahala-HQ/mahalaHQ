"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { colorForName } from "@/lib/color";

function revalidateDay() {
  revalidatePath("/calendar/day");
  revalidatePath("/calendar");
}

export async function addTask(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();
  const date = formData.get("date") as string;
  const kind = formData.get("kind") as string;
  const text = (formData.get("text") as string)?.trim();

  if (!text) return { error: "Type something first." };
  if (!["todo", "followup"].includes(kind)) return { error: "Invalid list." };

  const { error } = await supabase.from("day_planner_tasks").insert({
    household_id: household.householdId,
    date,
    kind,
    text,
  });

  if (error) return { error: error.message };
  revalidateDay();
  return { success: true };
}

export async function toggleTask(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const isDone = formData.get("is_done") === "true";

  await supabase.from("day_planner_tasks").update({ is_done: !isDone }).eq("id", id);
  revalidateDay();
}

export async function deleteTask(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  const id = formData.get("id") as string;

  await supabase.from("day_planner_tasks").delete().eq("id", id);
  revalidateDay();
}

/** "Just type it in" quick entry for a hour block -- creates a minimal calendar_events row
 *  (same table the rest of the calendar uses, so it shows up everywhere events do) without
 *  going through the full Add Event form. */
export async function quickAddHourEvent(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();
  const date = formData.get("date") as string;
  const hour = formData.get("hour") as string;
  const title = (formData.get("title") as string)?.trim();

  if (!title) return { error: "Type something first." };

  const { error } = await supabase.from("calendar_events").insert({
    household_id: household.householdId,
    title,
    start_at: `${date}T${hour}:00`,
    all_day: false,
    color: colorForName("shared"),
    event_type: "general",
    created_by: household.userId,
  });

  if (error) return { error: error.message };
  revalidateDay();
  return { success: true };
}
