import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "adult" | "kid" | "sitter";

export type CurrentHousehold = {
  householdId: string;
  householdName: string;
  inviteCode: string;
  calendarFeedToken: string;
  memberId: string;
  displayName: string;
  role: Role;
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
    .select("id, display_name, role, household_id, households ( name, invite_code, calendar_feed_token )")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const household = membership.households as unknown as {
    name: string;
    invite_code: string;
    calendar_feed_token: string;
  };

  return {
    householdId: membership.household_id,
    householdName: household.name,
    inviteCode: household.invite_code,
    calendarFeedToken: household.calendar_feed_token,
    memberId: membership.id,
    displayName: membership.display_name,
    role: membership.role as Role,
    userId: user.id,
  };
}

/** Bounces kid and sitter accounts to the dashboard — use on pages with financial/sensitive data (budget, debts, documents, etc). */
export async function requireAdult(): Promise<CurrentHousehold> {
  const household = await requireHousehold();
  if (household.role === "kid" || household.role === "sitter") redirect("/dashboard");
  return household;
}

/** Bounces only kid accounts — use on pages a sitter should also see (family info, emergency contacts). */
export async function requireCaregiver(): Promise<CurrentHousehold> {
  const household = await requireHousehold();
  if (household.role === "kid") redirect("/dashboard");
  return household;
}
