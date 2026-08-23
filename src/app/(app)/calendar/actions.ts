"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { colorForName } from "@/lib/color";

export async function addEvent(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();

  const date = formData.get("date") as string;
  const time = formData.get("time") as string;
  const allDay = !time;
  const startAt = allDay ? `${date}T00:00:00` : `${date}T${time}:00`;
  const assignedTo = (formData.get("assigned_to") as string) || "";

  await supabase.from("calendar_events").insert({
    household_id: household.householdId,
    title: formData.get("title") as string,
    location: formData.get("location") as string,
    assigned_to: assignedTo,
    start_at: startAt,
    all_day: allDay,
    color: colorForName(assignedTo || "shared"),
    created_by: household.userId,
  });

  revalidatePath("/calendar");
}

export async function deleteEvent(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("calendar_events").delete().eq("id", formData.get("id") as string);
  revalidatePath("/calendar");
}
