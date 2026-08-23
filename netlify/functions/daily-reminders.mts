import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

async function dailyReminders() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY!;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mahalahq.org";
  const admin = createClient(supabaseUrl, supabaseKey);
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  const today = new Date().toISOString().slice(0, 10);

  const { data: households } = await admin.from("households").select("id, name");

  for (const household of households ?? []) {
    const [{ data: chores }, { data: maintenance }] = await Promise.all([
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
    ]);

    if (!chores?.length && !maintenance?.length) continue;
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

    const html = `
      <p>Here's what's due today or overdue for <strong>${household.name}</strong>:</p>
      ${choreItems ? `<p><strong>Chores</strong></p><ul>${choreItems}</ul>` : ""}
      ${maintenanceItems ? `<p><strong>Maintenance</strong></p><ul>${maintenanceItems}</ul>` : ""}
      <p><a href="${siteUrl}/chores">Open Family Portal</a></p>
    `;

    await resend.emails.send({
      from: "Family Portal <invites@mahalahq.org>",
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
