"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdult } from "@/lib/household";

const STARTER_SECTIONS = [
  {
    title: "Using 1Password",
    body: `I use 1Password to store all our passwords. If something happens to me, here's how to get in:

1. Go to 1password.com or open the 1Password app.
2. Look for "Emergency Access" and request it.
3. I've added you as my emergency contact. I'll get a notification, and if I don't respond within the wait period, you're automatically granted access.
4. Once you're in, you'll see every saved login — banking, email, bills, this app, everything.
5. Start with: our bank login, my email, and Mahala HQ.

1Password has live support/chat if you get stuck — you don't need me for that part.`,
  },
  {
    title: "Important Documents",
    body: "Where the will, life insurance policy, and property deed are kept:\n\n(fill this in)",
  },
  {
    title: "Key People",
    body: "Attorney, financial advisor, accountant — see the Emergency Contacts page for phone numbers. Anyone else important:\n\n(fill this in)",
  },
  {
    title: "Final Wishes",
    body: "(fill this in)",
  },
];

/** Seeds a household's first visit with starter sections (never passwords, just pointers and
 *  instructions) so the page is immediately useful instead of a blank page to fill from scratch. */
export async function ensureSeeded(householdId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("emergency_info_sections")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId);

  if (count) return;

  await supabase.from("emergency_info_sections").insert(
    STARTER_SECTIONS.map((s, i) => ({
      household_id: householdId,
      title: s.title,
      body: s.body,
      position: i,
    }))
  );
}

export async function addSection(formData: FormData) {
  const household = await requireAdult();
  const supabase = await createClient();
  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const { count } = await supabase
    .from("emergency_info_sections")
    .select("id", { count: "exact", head: true })
    .eq("household_id", household.householdId);

  await supabase.from("emergency_info_sections").insert({
    household_id: household.householdId,
    title,
    body: (formData.get("body") as string) || "",
    position: count ?? 0,
  });

  revalidatePath("/emergency-info");
}

export async function updateSection(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireAdult();
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const title = (formData.get("title") as string)?.trim();
  if (!title) return { error: "Give the section a title." };

  const { error } = await supabase
    .from("emergency_info_sections")
    .update({ title, body: (formData.get("body") as string) || "" })
    .eq("id", id)
    .eq("household_id", household.householdId);

  if (error) return { error: error.message };
  revalidatePath("/emergency-info");
  return { success: true };
}

export async function deleteSection(formData: FormData) {
  await requireAdult();
  const supabase = await createClient();
  await supabase.from("emergency_info_sections").delete().eq("id", formData.get("id") as string);
  revalidatePath("/emergency-info");
}
