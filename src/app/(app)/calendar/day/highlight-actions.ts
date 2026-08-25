"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";

function revalidateDay() {
  revalidatePath("/calendar/day");
}

export async function addHighlight(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();

  const date = formData.get("date") as string;
  const startHour = Number(formData.get("start_hour"));
  const spanHours = Math.max(1, Number(formData.get("span_hours") || 1));
  const color = formData.get("color") as string;
  const label = ((formData.get("label") as string) || "").trim() || null;

  if (!color) return { error: "Pick a color." };

  const { error } = await supabase.from("day_planner_highlights").insert({
    household_id: household.householdId,
    date,
    start_hour: startHour,
    span_hours: spanHours,
    color,
    label,
  });

  if (error) return { error: error.message };
  revalidateDay();
  return { success: true };
}

export async function deleteHighlight(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("day_planner_highlights").delete().eq("id", formData.get("id") as string);
  revalidateDay();
}
