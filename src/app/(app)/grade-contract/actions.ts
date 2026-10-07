"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { CONTRACT_VERSION } from "@/lib/grade-contract";

/** Records that the signed-in person has read and agreed to the current grade agreement. */
export async function agreeToContract(): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  if (household.role === "sitter") return { error: "Only family members can agree to this." };
  const supabase = await createClient();

  const { error } = await supabase.from("grade_contract_agreements").upsert(
    {
      household_id: household.householdId,
      member_id: household.memberId,
      version: CONTRACT_VERSION,
      agreed_at: new Date().toISOString(),
    },
    { onConflict: "member_id,version" }
  );
  if (error) return { error: error.message };

  revalidatePath("/grade-contract");
  return { success: true };
}
