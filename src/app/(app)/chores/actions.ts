"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAdult, requireHousehold } from "@/lib/household";
import { sendPushToManagers, sendPushToMember } from "@/lib/push";
import { todayEasternDateStr } from "@/lib/chore-reminders";

export async function addChore(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();
  const assignedMemberIds = (formData.getAll("assigned_member_id") as string[]).filter(Boolean);
  const eligibleMemberIds = (formData.getAll("eligible_member_id") as string[]).filter(Boolean);

  let assignedNames: string[] = [];
  if (assignedMemberIds.length) {
    const { data: memberRows } = await supabase.from("household_members").select("id, display_name").in("id", assignedMemberIds);
    assignedNames = assignedMemberIds
      .map((id) => memberRows?.find((m) => m.id === id)?.display_name)
      .filter((n): n is string => !!n);
  }

  const title = formData.get("title") as string;
  const frequency = (formData.get("frequency") as string) || "once";
  const daysOfWeek = (formData.getAll("days_of_week") as string[]).map(Number).filter((n) => !Number.isNaN(n));
  const creditWhoeverCompletes = formData.get("credit_whoever_completes") === "on";

  const { data: chore, error } = await supabase
    .from("chores")
    .insert({
      household_id: household.householdId,
      title,
      assigned_member_id: assignedMemberIds[0] ?? null,
      assigned_to: assignedNames.join(", ") || null,
      frequency,
      days_of_week: frequency === "weekly" && daysOfWeek.length ? daysOfWeek : null,
      points: Number(formData.get("points") || 0),
      due_date: (formData.get("due_date") as string) || null,
      credit_whoever_completes: creditWhoeverCompletes,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (assignedMemberIds.length) {
    const { error: assigneeError } = await supabase
      .from("chore_assignees")
      .insert(assignedMemberIds.map((memberId) => ({ household_id: household.householdId, chore_id: chore.id, member_id: memberId })));
    if (assigneeError) return { error: assigneeError.message };

    for (const memberId of assignedMemberIds) {
      await sendPushToMember(supabase, memberId, {
        title: "🧹 New chore assigned",
        body: title,
        url: "/chores",
      });
    }
  }

  // Eligibility is separate from assignment: no rows = everyone can claim it.
  if (eligibleMemberIds.length) {
    const { error: eligError } = await supabase
      .from("chore_eligibility")
      .insert(eligibleMemberIds.map((memberId) => ({ household_id: household.householdId, chore_id: chore.id, member_id: memberId })));
    if (eligError) return { error: eligError.message };
  }

  revalidatePath("/chores");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateChore(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const title = (formData.get("title") as string)?.trim();
  if (!id) return { error: "Missing chore." };
  if (!title) return { error: "Name the chore." };

  const assignedMemberIds = (formData.getAll("assigned_member_id") as string[]).filter(Boolean);
  const eligibleMemberIds = (formData.getAll("eligible_member_id") as string[]).filter(Boolean);
  const frequency = (formData.get("frequency") as string) || "once";
  const daysOfWeek = (formData.getAll("days_of_week") as string[]).map(Number).filter((n) => !Number.isNaN(n));
  const creditWhoeverCompletes = formData.get("credit_whoever_completes") === "on";

  let assignedNames: string[] = [];
  if (assignedMemberIds.length) {
    const { data: memberRows } = await supabase.from("household_members").select("id, display_name").in("id", assignedMemberIds);
    assignedNames = assignedMemberIds
      .map((memberId) => memberRows?.find((m) => m.id === memberId)?.display_name)
      .filter((n): n is string => !!n);
  }

  const { error } = await supabase
    .from("chores")
    .update({
      title,
      assigned_member_id: assignedMemberIds[0] ?? null,
      assigned_to: assignedNames.join(", ") || null,
      frequency,
      days_of_week: frequency === "weekly" && daysOfWeek.length ? daysOfWeek : null,
      points: Number(formData.get("points") || 0),
      due_date: (formData.get("due_date") as string) || null,
      credit_whoever_completes: creditWhoeverCompletes,
    })
    .eq("id", id)
    .eq("household_id", household.householdId);

  if (error) return { error: error.message };

  const { error: deleteError } = await supabase.from("chore_assignees").delete().eq("chore_id", id);
  if (deleteError) return { error: deleteError.message };

  if (assignedMemberIds.length) {
    const { error: assigneeError } = await supabase
      .from("chore_assignees")
      .insert(assignedMemberIds.map((memberId) => ({ household_id: household.householdId, chore_id: id, member_id: memberId })));
    if (assigneeError) return { error: assigneeError.message };
  }

  const { error: deleteEligError } = await supabase.from("chore_eligibility").delete().eq("chore_id", id);
  if (deleteEligError) return { error: deleteEligError.message };

  if (eligibleMemberIds.length) {
    const { error: eligError } = await supabase
      .from("chore_eligibility")
      .insert(eligibleMemberIds.map((memberId) => ({ household_id: household.householdId, chore_id: id, member_id: memberId })));
    if (eligError) return { error: eligError.message };
  }

  revalidatePath("/chores");
  revalidatePath("/dashboard");
  return { success: true };
}

function advanceDueDate(dateStr: string, frequency: string, daysOfWeek?: number[] | null): string {
  const d = new Date(`${dateStr}T00:00:00`);

  if (frequency === "weekly" && daysOfWeek?.length) {
    // Jump to the next date (after d) that falls on one of the selected weekdays -- e.g. Mon/
    // Wed/Fri instead of a flat +7 days. Looping up to 14 days guarantees a hit even with a
    // single selected day.
    for (let i = 1; i <= 14; i++) {
      const candidate = new Date(d);
      candidate.setDate(candidate.getDate() + i);
      if (daysOfWeek.includes(candidate.getDay())) return candidate.toISOString().slice(0, 10);
    }
  }

  switch (frequency) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      break;
  }
  return d.toISOString().slice(0, 10);
}

type ChoreRow = {
  id: string;
  frequency: string;
  status: string;
  due_date: string | null;
  days_of_week: number[] | null;
};

/**
 * Shared by completeChore and skipChore: a one-time chore flips to done; a recurring chore
 * resets to open immediately (so it reappears next cycle) and its due date advances to the next
 * occurrence. Returns false if there was nothing to advance (a one-time chore already done).
 */
async function advanceChoreSchedule(supabase: SupabaseClient, chore: ChoreRow): Promise<boolean> {
  if (chore.frequency === "once") {
    if (chore.status === "done") return false;
    const { error } = await supabase
      .from("chores")
      .update({ status: "done", last_completed_at: new Date().toISOString() })
      .eq("id", chore.id);
    if (error) throw new Error(error.message);
    return true;
  }

  const nextDue = chore.due_date ? advanceDueDate(chore.due_date, chore.frequency, chore.days_of_week) : null;
  const { error } = await supabase
    .from("chores")
    .update({ status: "open", last_completed_at: new Date().toISOString(), due_date: nextDue })
    .eq("id", chore.id);
  if (error) throw new Error(error.message);
  return true;
}

/** Who earns the points, and their display name + whether their points auto-approve. */
async function creditRecipients(
  supabase: SupabaseClient,
  chore: { id: string; credit_whoever_completes: boolean; assigned_member_id: string | null },
  clickerMemberId: string
): Promise<{ memberId: string; name: string | null; autoApprove: boolean }[]> {
  const { data: assignees } = await supabase.from("chore_assignees").select("member_id").eq("chore_id", chore.id);
  const assigneeIds = (assignees ?? []).map((a) => a.member_id);

  // Alternating chore, or a shared/unassigned "first person to do it earns it" chore -> only
  // whoever clicked. Otherwise every assignee gets full credit ("you both did it").
  const memberIds =
    chore.credit_whoever_completes || assigneeIds.length === 0
      ? [clickerMemberId]
      : assigneeIds;

  const { data: memberRows } = await supabase
    .from("household_members")
    .select("id, display_name, role")
    .in("id", memberIds);

  return memberIds.map((memberId) => {
    const row = memberRows?.find((m) => m.id === memberId);
    return {
      memberId,
      name: row?.display_name ?? null,
      autoApprove: row?.role === "admin" || row?.role === "adult",
    };
  });
}

export async function completeChore(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();
  const id = formData.get("id") as string;

  const { data: chore, error: fetchError } = await supabase.from("chores").select("*").eq("id", id).single();
  if (fetchError) throw new Error(fetchError.message);
  if (!chore) return;

  const advanced = await advanceChoreSchedule(supabase, chore);
  if (!advanced) return; // one-time chore already done

  if (chore.points > 0) {
    const recipients = await creditRecipients(supabase, chore, household.memberId);
    if (recipients.length) {
      const now = new Date().toISOString();
      const { error } = await supabase.from("chore_completions").insert(
        recipients.map((r) => ({
          household_id: household.householdId,
          chore_id: chore.id,
          member_id: r.memberId,
          points: chore.points,
          kind: "completed",
          approval_status: r.autoApprove ? "approved" : "pending",
          chore_title: chore.title,
          member_name: r.name,
          decided_at: r.autoApprove ? now : null,
          decided_by: r.autoApprove ? household.userId : null,
        }))
      );
      if (error) throw new Error(error.message);

      // A kid's points wait for a grown-up -- let the grown-ups know there's something to approve.
      if (recipients.some((r) => !r.autoApprove)) {
        await sendPushToManagers(
          supabase,
          household.householdId,
          {
            title: "✅ Chore to approve",
            body: `${household.displayName} did ${chore.title} — ⭐ ${chore.points} waiting for your approval`,
            url: "/chores",
          },
          { exceptMemberId: household.memberId }
        );
      }
    }
  }

  revalidatePath("/chores");
  revalidatePath("/dashboard");
}

/**
 * Like completeChore but awards 0 points -- for "I only did part of this" (washed a load but
 * didn't dry or fold it). Still advances the recurring schedule so the chore doesn't sit there
 * looking overdue, and lands in the activity log as a skip.
 */
export async function skipChore(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();
  const id = formData.get("id") as string;

  const { data: chore, error: fetchError } = await supabase.from("chores").select("*").eq("id", id).single();
  if (fetchError) throw new Error(fetchError.message);
  if (!chore) return;

  const advanced = await advanceChoreSchedule(supabase, chore);
  if (!advanced) return;

  const { error } = await supabase.from("chore_completions").insert({
    household_id: household.householdId,
    chore_id: chore.id,
    member_id: household.memberId,
    points: 0,
    kind: "skipped",
    approval_status: "approved",
    chore_title: chore.title,
    member_name: household.displayName,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/chores");
  revalidatePath("/dashboard");
}

/**
 * Adult override: force a chore back to claimable right now -- a recurring chore whose due date
 * is in the future (the just-cleaned porch got re-dirtied by a storm), or a finished one-time
 * chore that needs redoing.
 */
export async function makeChoreAvailable(formData: FormData) {
  const household = await requireAdult();
  const supabase = await createClient();
  const id = formData.get("id") as string;

  const { data: chore } = await supabase
    .from("chores")
    .select("title")
    .eq("id", id)
    .eq("household_id", household.householdId)
    .single();

  const { error } = await supabase
    .from("chores")
    .update({ status: "open", due_date: todayEasternDateStr() })
    .eq("id", id)
    .eq("household_id", household.householdId);
  if (error) throw new Error(error.message);

  // Tell the people who might do it that it's back on the board.
  const [{ data: assignees }, { data: eligible }] = await Promise.all([
    supabase.from("chore_assignees").select("member_id").eq("chore_id", id),
    supabase.from("chore_eligibility").select("member_id").eq("chore_id", id),
  ]);
  const notify = new Set(
    [...(assignees ?? []), ...(eligible ?? [])].map((r) => r.member_id).filter((m) => m !== household.memberId)
  );
  await Promise.all(
    [...notify].map((memberId) =>
      sendPushToMember(supabase, memberId, {
        title: "🧹 Chore available again",
        body: `${chore?.title ?? "A chore"} is ready to be done`,
        url: "/chores",
      })
    )
  );

  revalidatePath("/chores");
  revalidatePath("/dashboard");
}

export async function approveChoreCompletion(formData: FormData) {
  const household = await requireAdult();
  const supabase = await createClient();
  const id = formData.get("id") as string;

  const { data: completion } = await supabase
    .from("chore_completions")
    .select("member_id, chore_title, points")
    .eq("id", id)
    .eq("household_id", household.householdId)
    .single();

  await supabase
    .from("chore_completions")
    .update({ approval_status: "approved", decided_at: new Date().toISOString(), decided_by: household.userId })
    .eq("id", id)
    .eq("household_id", household.householdId);

  if (completion && completion.member_id !== household.memberId) {
    await sendPushToMember(supabase, completion.member_id, {
      title: "⭐ Points approved!",
      body: `${completion.points} points for ${completion.chore_title ?? "your chore"} — they're in your balance.`,
      url: "/dashboard",
    });
  }

  revalidatePath("/chores");
  revalidatePath("/dashboard");
}

/** Rejecting keeps the row (so it still shows in history) but it never counts toward a balance. */
export async function rejectChoreCompletion(formData: FormData) {
  const household = await requireAdult();
  const supabase = await createClient();
  const id = formData.get("id") as string;

  const { data: completion } = await supabase
    .from("chore_completions")
    .select("member_id, chore_title")
    .eq("id", id)
    .eq("household_id", household.householdId)
    .single();

  await supabase
    .from("chore_completions")
    .update({ approval_status: "rejected", decided_at: new Date().toISOString(), decided_by: household.userId })
    .eq("id", id)
    .eq("household_id", household.householdId);

  if (completion && completion.member_id !== household.memberId) {
    await sendPushToMember(supabase, completion.member_id, {
      title: "Chore points not approved",
      body: `${completion.chore_title ?? "That chore"} didn't get the points this time.`,
      url: "/dashboard",
    });
  }

  revalidatePath("/chores");
  revalidatePath("/dashboard");
}

export async function approveAllChoreCompletions() {
  const household = await requireAdult();
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("chore_completions")
    .select("member_id, points")
    .eq("household_id", household.householdId)
    .eq("approval_status", "pending")
    .eq("kind", "completed");

  await supabase
    .from("chore_completions")
    .update({ approval_status: "approved", decided_at: new Date().toISOString(), decided_by: household.userId })
    .eq("household_id", household.householdId)
    .eq("approval_status", "pending")
    .eq("kind", "completed");

  // One push per affected person with their newly-approved total.
  const totals = new Map<string, number>();
  for (const row of pending ?? []) {
    if (row.member_id === household.memberId) continue;
    totals.set(row.member_id, (totals.get(row.member_id) ?? 0) + row.points);
  }
  await Promise.all(
    [...totals].map(([memberId, points]) =>
      sendPushToMember(supabase, memberId, {
        title: "⭐ Points approved!",
        body: `${points} chore points just landed in your balance.`,
        url: "/dashboard",
      })
    )
  );

  revalidatePath("/chores");
  revalidatePath("/dashboard");
}

export async function deleteChore(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  const { error } = await supabase.from("chores").delete().eq("id", formData.get("id") as string);
  if (error) throw new Error(error.message);
  revalidatePath("/chores");
}
