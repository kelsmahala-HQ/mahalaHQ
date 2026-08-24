"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { colorForName } from "@/lib/color";

export async function addEvent(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();

  const date = formData.get("date") as string;
  const time = formData.get("time") as string;
  const allDay = !time;
  const startAt = allDay ? `${date}T00:00:00` : `${date}T${time}:00`;
  const assignedMemberId = (formData.get("assigned_member_id") as string) || null;
  const recurrence = (formData.get("recurrence") as string) || "none";
  const recurrenceEnd = (formData.get("recurrence_end") as string) || null;
  const eventType = (formData.get("event_type") as string) || "general";

  let assignedTo = "";
  if (assignedMemberId) {
    const { data: profile } = await supabase.from("family_profiles").select("member_name").eq("id", assignedMemberId).single();
    assignedTo = profile?.member_name ?? "";
  }

  const { error } = await supabase.from("calendar_events").insert({
    household_id: household.householdId,
    title: formData.get("title") as string,
    location: formData.get("location") as string,
    assigned_member_id: assignedMemberId,
    assigned_to: assignedTo,
    start_at: startAt,
    all_day: allDay,
    color: colorForName(assignedTo || "shared"),
    recurrence,
    recurrence_end: recurrence === "none" ? null : recurrenceEnd,
    event_type: eventType,
    created_by: household.userId,
  });

  if (error) return { error: error.message };

  revalidatePath("/calendar");
  return { success: true };
}

export async function updateEvent(formData: FormData): Promise<{ error: string } | { success: true }> {
  await requireHousehold();
  const supabase = await createClient();
  const id = formData.get("id") as string;

  const date = formData.get("date") as string;
  const time = formData.get("time") as string;
  const allDay = !time;
  const startAt = allDay ? `${date}T00:00:00` : `${date}T${time}:00`;
  const assignedMemberId = (formData.get("assigned_member_id") as string) || null;
  const recurrence = (formData.get("recurrence") as string) || "none";
  const recurrenceEnd = (formData.get("recurrence_end") as string) || null;
  const eventType = (formData.get("event_type") as string) || "general";

  let assignedTo = "";
  if (assignedMemberId) {
    const { data: profile } = await supabase.from("family_profiles").select("member_name").eq("id", assignedMemberId).single();
    assignedTo = profile?.member_name ?? "";
  }

  const { error } = await supabase
    .from("calendar_events")
    .update({
      title: formData.get("title") as string,
      location: formData.get("location") as string,
      assigned_member_id: assignedMemberId,
      assigned_to: assignedTo,
      start_at: startAt,
      all_day: allDay,
      color: colorForName(assignedTo || "shared"),
      recurrence,
      recurrence_end: recurrence === "none" ? null : recurrenceEnd,
      event_type: eventType,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/calendar");
  return { success: true };
}

export async function deleteEvent(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("calendar_events").delete().eq("id", formData.get("id") as string);
  revalidatePath("/calendar");
}

export async function updateGoogleCalendarUrl(formData: FormData) {
  const household = await requireHousehold();
  if (household.role !== "admin" && household.role !== "adult") return;
  const supabase = await createClient();
  const url = ((formData.get("google_calendar_url") as string) || "").trim();
  await supabase
    .from("households")
    .update({ google_calendar_url: url || null })
    .eq("id", household.householdId);
  revalidatePath("/calendar");
}
