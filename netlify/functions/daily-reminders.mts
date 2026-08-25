import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function advanceBill(date: Date, frequency: string): Date {
  const d = new Date(date);
  switch (frequency) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      return d;
    case "biweekly":
      d.setDate(d.getDate() + 14);
      return d;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      return d;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      return d;
    case "semiannual":
      d.setMonth(d.getMonth() + 6);
      return d;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      return d;
    default:
      return d; // 'once'
  }
}

/** Walks forward from a bill's anchor due_date to see if today is one of its occurrences. */
function isDueToday(dueDate: string, frequency: string, today: Date): boolean {
  let occurrence = new Date(`${dueDate}T00:00:00`);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let guard = 0;
  while (occurrence <= todayMidnight && guard < 500) {
    if (occurrence.getTime() === todayMidnight.getTime()) return true;
    if (frequency === "once") return false;
    occurrence = advanceBill(occurrence, frequency);
    guard++;
  }
  return false;
}

async function dailyReminders() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY!;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mahalahq.org";
  const admin = createClient(supabaseUrl, supabaseKey);
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const { data: households } = await admin.from("households").select("id, name");

  for (const household of households ?? []) {
    const [{ data: chores }, { data: maintenance }, { data: bills }, { data: paidToday }] = await Promise.all([
      admin
        .from("chores")
        .select("title, assigned_to, due_date")
        .eq("household_id", household.id)
        .eq("status", "open")
        .not("due_date", "is", null)
        .lte("due_date", today),
      admin
        .from("maintenance_tasks")
        .select("title, next_due_at")
        .eq("household_id", household.id)
        .not("next_due_at", "is", null)
        .lte("next_due_at", today),
      admin.from("bills").select("id, name, frequency, due_date").eq("household_id", household.id),
      admin.from("bill_payments").select("bill_id").eq("household_id", household.id).eq("paid_on", today),
    ]);

    const paidBillIds = new Set((paidToday ?? []).map((p) => p.bill_id));
    const billsDueToday = (bills ?? []).filter((b) => isDueToday(b.due_date, b.frequency, now) && !paidBillIds.has(b.id));

    if (!chores?.length && !maintenance?.length && !billsDueToday.length) continue;
    if (!resend) continue;

    const { data: members } = await admin
      .from("household_members")
      .select("user_id")
      .eq("household_id", household.id)
      .in("role", ["admin", "adult", "kid"]);

    const emails: string[] = [];
    for (const member of members ?? []) {
      const { data } = await admin.auth.admin.getUserById(member.user_id);
      if (data.user?.email) emails.push(data.user.email);
    }
    if (!emails.length) continue;

    const choreItems = (chores ?? [])
      .map((c) => `<li>${c.title}${c.assigned_to ? ` — ${c.assigned_to}` : ""} (due ${c.due_date})</li>`)
      .join("");
    const maintenanceItems = (maintenance ?? [])
      .map((m) => `<li>${m.title} (due ${m.next_due_at})</li>`)
      .join("");
    // Names only, no amounts -- this digest also reaches kid accounts, which never see financial figures elsewhere in the app.
    const billItems = billsDueToday.map((b) => `<li>${b.name}</li>`).join("");

    const html = `
      <p>Here's what's due today or overdue for <strong>${household.name}</strong>:</p>
      ${choreItems ? `<p><strong>Chores</strong></p><ul>${choreItems}</ul>` : ""}
      ${maintenanceItems ? `<p><strong>Maintenance</strong></p><ul>${maintenanceItems}</ul>` : ""}
      ${billItems ? `<p><strong>Bills due today</strong></p><ul>${billItems}</ul>` : ""}
      <p><a href="${siteUrl}/chores">Open Mahala HQ</a></p>
    `;

    await resend.emails.send({
      from: "Mahala HQ <invites@mahalahq.org>",
      to: emails,
      subject: `📋 ${household.name}: things due today`,
      html,
    });
  }
}

export default dailyReminders;

// 20:00 UTC = 4pm Eastern Daylight Time. Bump to "0 21 * * *" once clocks fall back to
// Eastern Standard Time in November, since Netlify's cron schedule is fixed UTC (no DST awareness).
export const config: Config = {
  schedule: "0 20 * * *",
};
