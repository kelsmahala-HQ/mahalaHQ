"use server";

import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
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

export async function updateOwnPhone(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();
  const phone = formData.get("phone") as string;

  await supabase.from("household_members").update({ phone }).eq("id", household.memberId);

  revalidatePath("/settings");
}

export async function sendInviteEmail(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const email = (formData.get("email") as string)?.trim();
  if (!email) return { error: "Enter an email address." };

  if (!process.env.RESEND_API_KEY) {
    return { error: "Email invites aren't set up yet — add RESEND_API_KEY in Netlify's environment variables." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mahalahq.org";
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: "Family Portal <onboarding@resend.dev>",
    to: email,
    subject: `${household.displayName} invited you to join ${household.householdName}`,
    html: `
      <p>${household.displayName} invited you to join <strong>${household.householdName}</strong> on Family Portal — a shared spot for budgets, chores, the calendar, and more.</p>
      <ol>
        <li>Go to <a href="${siteUrl}">${siteUrl}</a></li>
        <li>Sign up for an account</li>
        <li>Choose "Have an invite code? Join instead" and enter: <strong>${household.inviteCode}</strong></li>
      </ol>
    `,
  });

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { success: true };
}
