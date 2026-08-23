"use server";

import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/household";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateMemberRole(formData: FormData) {
  const household = await requireHousehold();
  if (household.role !== "admin") return; // only admins manage other members' access

  const memberId = formData.get("member_id") as string;
  const role = formData.get("role") as string;
  if (!["admin", "adult", "kid"].includes(role)) return;

  const admin = createAdminClient();
  await admin.from("household_members").update({ role }).eq("id", memberId).eq("household_id", household.householdId);

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
