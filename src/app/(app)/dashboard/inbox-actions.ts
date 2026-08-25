"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";

export async function addInboxItem(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();
  const text = ((formData.get("text") as string) || "").trim();
  if (!text) return;

  await supabase.from("inbox_items").insert({
    household_id: household.householdId,
    text,
    created_by: household.memberId,
  });

  revalidatePath("/dashboard");
}

export async function removeInboxItem(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();
  await supabase.from("inbox_items").delete().eq("id", formData.get("id") as string).eq("household_id", household.householdId);
  revalidatePath("/dashboard");
}

async function convertInboxItem(
  formData: FormData,
  insert: (
    supabase: Awaited<ReturnType<typeof createClient>>,
    household: Awaited<ReturnType<typeof requireHousehold>>,
    text: string
  ) => PromiseLike<unknown>
) {
  const household = await requireHousehold();
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const text = formData.get("text") as string;

  await insert(supabase, household, text);
  await supabase.from("inbox_items").delete().eq("id", id).eq("household_id", household.householdId);

  revalidatePath("/dashboard");
}

export async function convertInboxToTodo(formData: FormData) {
  await convertInboxItem(formData, (supabase, household, text) =>
    supabase.from("day_planner_tasks").insert({
      household_id: household.householdId,
      date: new Date().toISOString().slice(0, 10),
      kind: "todo",
      text,
    })
  );
  revalidatePath("/calendar/day");
}

export async function convertInboxToFollowup(formData: FormData) {
  await convertInboxItem(formData, (supabase, household, text) =>
    supabase.from("day_planner_tasks").insert({
      household_id: household.householdId,
      date: new Date().toISOString().slice(0, 10),
      kind: "followup",
      text,
    })
  );
  revalidatePath("/calendar/day");
}

export async function convertInboxToGrocery(formData: FormData) {
  await convertInboxItem(formData, (supabase, household, text) =>
    supabase.from("grocery_items").insert({
      household_id: household.householdId,
      name: text,
      added_by: household.userId,
    })
  );
  revalidatePath("/groceries");
}
