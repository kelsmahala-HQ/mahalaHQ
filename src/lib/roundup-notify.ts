import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

/** Emails household admins once when the round-up jar first crosses the threshold. Idempotent via roundup_settings.notified. */
export async function notifyIfThresholdReached(householdId: string, householdName: string) {
  if (!process.env.RESEND_API_KEY) return;
  const admin = createAdminClient();

  const [{ data: settings }, { data: purchases }, { data: payouts }, { data: focusDebt }] = await Promise.all([
    admin.from("roundup_settings").select("threshold, notified").eq("household_id", householdId).maybeSingle(),
    admin.from("roundup_purchases").select("round_up").eq("household_id", householdId),
    admin.from("roundup_payouts").select("amount").eq("household_id", householdId),
    admin.from("debts").select("name").eq("household_id", householdId).eq("is_focus", true).maybeSingle(),
  ]);

  const threshold = Number(settings?.threshold ?? 25);
  const totalSaved = (purchases ?? []).reduce((sum, p) => sum + Number(p.round_up), 0);
  const totalPaidOut = (payouts ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const available = totalSaved - totalPaidOut;

  if (available < threshold || settings?.notified) return;

  const { data: admins } = await admin
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId)
    .in("role", ["admin", "adult"]);

  const emails: string[] = [];
  for (const member of admins ?? []) {
    const { data } = await admin.auth.admin.getUserById(member.user_id);
    if (data.user?.email) emails.push(data.user.email);
  }

  if (emails.length) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const debtText = focusDebt ? `toward ${focusDebt.name}` : "toward your focus debt";
    await resend.emails.send({
      from: "Family Portal <onboarding@resend.dev>",
      to: emails,
      subject: `🪙 ${householdName}'s Round-Up jar hit $${threshold}`,
      html: `<p>Your spare change jar just reached <strong>$${threshold.toFixed(2)}</strong> ${debtText}. Open the Round-Up page to send it.</p>`,
    });
  }

  await admin.from("roundup_settings").upsert({ household_id: householdId, notified: true });
}
