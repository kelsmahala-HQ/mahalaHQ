import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { sendDueChoreReminders } from "../../src/lib/chore-reminders";

/** Scheduled sweep across every household. If Netlify's scheduler doesn't actually fire this
 *  reliably, the Dashboard page also calls sendDueChoreReminders as a fallback -- the shared
 *  per-household dedup means it's safe for both to exist. */
async function choreReminders() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  await sendDueChoreReminders(admin);
}

export default choreReminders;

// Once daily, ~8-9am Eastern depending on DST.
export const config: Config = {
  schedule: "0 13 * * *",
};
