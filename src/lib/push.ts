import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

type PushSubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

/** Sends one push message to every subscribed device for the given rows, pruning any that the
 *  push service reports as gone (410/404 -- the user uninstalled, cleared data, etc). */
export async function sendPushToSubscriptions(
  supabase: SupabaseClient,
  subscriptions: PushSubscriptionRow[],
  payload: { title: string; body: string; url?: string }
) {
  ensureConfigured();
  if (!configured || !subscriptions.length) return;

  const deadIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) deadIds.push(sub.id);
      }
    })
  );

  if (deadIds.length) {
    await supabase.from("push_subscriptions").delete().in("id", deadIds);
  }
}

/** Sends to every device subscribed for a specific household member. */
export async function sendPushToMember(supabase: SupabaseClient, memberId: string, payload: { title: string; body: string; url?: string }) {
  const { data } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("member_id", memberId);
  await sendPushToSubscriptions(supabase, data ?? [], payload);
}

/** Sends to every device subscribed anywhere in a household (used for "whole family" events). */
export async function sendPushToHousehold(supabase: SupabaseClient, householdId: string, payload: { title: string; body: string; url?: string }) {
  const { data } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("household_id", householdId);
  await sendPushToSubscriptions(supabase, data ?? [], payload);
}
