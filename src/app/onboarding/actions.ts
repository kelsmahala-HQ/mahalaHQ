"use server";

import { createClient } from "@/lib/supabase/server";

type Result = { error: string } | { success: true };

export async function createHousehold(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const name = formData.get("name") as string;
  const displayName = formData.get("displayName") as string;

  const { data: household, error: householdError } = await supabase
    .from("households")
    .insert({ name })
    .select("id")
    .single();

  if (householdError || !household) {
    return { error: householdError?.message ?? "Could not create household." };
  }

  const { error: memberError } = await supabase.from("household_members").insert({
    household_id: household.id,
    user_id: user.id,
    display_name: displayName,
    role: "admin",
  });

  if (memberError) return { error: memberError.message };

  return { success: true };
}

export async function joinHousehold(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const inviteCode = (formData.get("inviteCode") as string).trim();
  const displayName = formData.get("displayName") as string;

  const { data: household, error: findError } = await supabase
    .from("households")
    .select("id")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (findError || !household) {
    return { error: "No household found with that invite code." };
  }

  const { error: memberError } = await supabase.from("household_members").insert({
    household_id: household.id,
    user_id: user.id,
    display_name: displayName,
    role: "adult",
  });

  if (memberError) return { error: memberError.message };

  return { success: true };
}
