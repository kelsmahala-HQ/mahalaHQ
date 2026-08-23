import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentHousehold = {
  householdId: string;
  householdName: string;
  inviteCode: string;
  memberId: string;
  displayName: string;
  role: "admin" | "adult" | "kid";
  userId: string;
};

/** Loads the signed-in user's household context, or sends them to onboarding/login. */
export async function requireHousehold(): Promise<CurrentHousehold> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("household_members")
    .select("id, display_name, role, household_id, households ( name, invite_code )")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const household = membership.households as unknown as {
    name: string;
    invite_code: string;
  };

  return {
    householdId: membership.household_id,
    householdName: household.name,
    inviteCode: household.invite_code,
    memberId: membership.id,
    displayName: membership.display_name,
    role: membership.role as "admin" | "adult" | "kid",
    userId: user.id,
  };
}

/** Same as requireHousehold(), but bounces kid accounts to the dashboard — use on adult-only pages. */
export async function requireAdult(): Promise<CurrentHousehold> {
  const household = await requireHousehold();
  if (household.role === "kid") redirect("/dashboard");
  return household;
}
