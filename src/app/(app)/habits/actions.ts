"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { todayEasternDateStr } from "@/lib/chore-reminders";
import { addDaysStr } from "@/lib/habits";

/** Habits are personal: everything here is scoped to the signed-in person, and the database enforces it too. */
async function requireHabitUser() {
  const household = await requireHousehold();
  if (household.role === "sitter") throw new Error("Habits are for family members.");
  return household;
}

function parseHabitForm(formData: FormData) {
  const name = ((formData.get("name") as string) ?? "").trim();
  const emoji = ((formData.get("emoji") as string) ?? "").trim().slice(0, 8) || null;
  const days = (formData.getAll("days_of_week") as string[])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  // Every weekday ticked is the same as "every day".
  const daysOfWeek = days.length && days.length < 7 ? [...new Set(days)].sort() : null;
  return { name, emoji, daysOfWeek };
}

export async function addHabit(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHabitUser();
  const supabase = await createClient();
  const { name, emoji, daysOfWeek } = parseHabitForm(formData);
  if (!name) return { error: "Name the habit." };

  const { error } = await supabase.from("habits").insert({
    household_id: household.householdId,
    member_id: household.memberId,
    name,
    emoji,
    days_of_week: daysOfWeek,
  });
  if (error) return { error: error.message };

  revalidatePath("/habits");
  return { success: true };
}

export async function updateHabit(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHabitUser();
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const { name, emoji, daysOfWeek } = parseHabitForm(formData);
  if (!id) return { error: "Missing habit." };
  if (!name) return { error: "Name the habit." };

  const { error } = await supabase
    .from("habits")
    .update({ name, emoji, days_of_week: daysOfWeek })
    .eq("id", id)
    .eq("member_id", household.memberId);
  if (error) return { error: error.message };

  revalidatePath("/habits");
  return { success: true };
}

/** Archiving hides a habit but keeps its history; restoring brings it back. */
export async function setHabitArchived(formData: FormData) {
  const household = await requireHabitUser();
  const supabase = await createClient();
  await supabase
    .from("habits")
    .update({ archived: formData.get("archived") === "true" })
    .eq("id", formData.get("id") as string)
    .eq("member_id", household.memberId);
  revalidatePath("/habits");
}

/** Taps a day on or off. Only today and the recent past can be changed -- no checking off the future. */
export async function toggleHabitDay(habitId: string, date: string): Promise<{ error: string } | { done: boolean }> {
  const household = await requireHabitUser();
  const supabase = await createClient();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "That isn't a valid day." };
  const today = todayEasternDateStr();
  if (date > today) return { error: "You can't check off a day that hasn't happened yet." };
  if (date < addDaysStr(today, -60)) return { error: "That day is too far back to change." };

  const { data: habit } = await supabase
    .from("habits")
    .select("id")
    .eq("id", habitId)
    .eq("member_id", household.memberId)
    .maybeSingle();
  if (!habit) return { error: "That habit isn't yours." };

  const { data: existing } = await supabase
    .from("habit_checkins")
    .select("id")
    .eq("habit_id", habitId)
    .eq("date", date)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("habit_checkins").delete().eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath("/habits");
    return { done: false };
  }

  const { error } = await supabase
    .from("habit_checkins")
    .insert({ household_id: household.householdId, habit_id: habitId, date });
  if (error) return { error: error.message };

  revalidatePath("/habits");
  return { done: true };
}
