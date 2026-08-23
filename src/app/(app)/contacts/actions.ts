"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";

export async function addContact(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();

  await supabase.from("emergency_contacts").insert({
    household_id: household.householdId,
    name: formData.get("name") as string,
    relationship: formData.get("relationship") as string,
    category: formData.get("category") as string,
    phone: formData.get("phone") as string,
    email: formData.get("email") as string,
    notes: formData.get("notes") as string,
  });

  revalidatePath("/contacts");
}

export async function deleteContact(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("emergency_contacts").delete().eq("id", formData.get("id") as string);
  revalidatePath("/contacts");
}
