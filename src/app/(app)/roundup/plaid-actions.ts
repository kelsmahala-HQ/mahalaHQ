"use server";

import { revalidatePath } from "next/cache";
import { CountryCode, Products } from "plaid";
import { requireHousehold } from "@/lib/household";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPlaidClient } from "@/lib/plaid";
import { calculateRoundUp } from "@/lib/roundup";
import { notifyIfThresholdReached } from "@/lib/roundup-notify";

export async function createLinkToken(): Promise<{ linkToken: string } | { error: string }> {
  const household = await requireHousehold();
  const client = createPlaidClient();

  try {
    const response = await client.linkTokenCreate({
      user: { client_user_id: household.householdId },
      client_name: "Mahala HQ",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return { linkToken: response.data.link_token };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not start bank connection." };
  }
}

export async function exchangePublicToken(
  publicToken: string,
  institutionName: string
): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const client = createPlaidClient();
  const admin = createAdminClient();

  try {
    // Plaid's regular Link flow (the only one this app offers -- there's no "update mode" for
    // repairing an existing item) always creates a brand-new Item, even when reconnecting the
    // same real bank. Left alone, a broken connection you "reconnect" would just pile up as a
    // second row for the same institution instead of replacing the broken one -- so remove any
    // existing item for this institution first, the same way clicking Disconnect would.
    const { data: existing } = await admin
      .from("plaid_items")
      .select("id, access_token")
      .eq("household_id", household.householdId)
      .eq("institution_name", institutionName);
    for (const old of existing ?? []) {
      try {
        await client.itemRemove({ access_token: old.access_token });
      } catch {
        // Already broken/revoked on Plaid's side -- fine, we're replacing it anyway.
      }
      await admin.from("plaid_items").delete().eq("id", old.id);
    }

    const response = await client.itemPublicTokenExchange({ public_token: publicToken });
    const accessToken = response.data.access_token;

    // Plaid's first sync on a freshly-linked item returns the account's entire transaction
    // history, not just what happens from here on. Fast-forward through that initial batch
    // without recording any of it as a round-up purchase, so Round-Up only starts counting
    // transactions from today forward -- not everything the account has ever done.
    let cursor: string | undefined;
    let hasMore = true;
    while (hasMore) {
      const syncResponse = await client.transactionsSync({ access_token: accessToken, cursor });
      cursor = syncResponse.data.next_cursor;
      hasMore = syncResponse.data.has_more;
    }

    await admin.from("plaid_items").insert({
      household_id: household.householdId,
      item_id: response.data.item_id,
      access_token: accessToken,
      institution_name: institutionName,
      cursor,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not link account." };
  }

  revalidatePath("/roundup");
  return { success: true };
}

export async function removePlaidItem(formData: FormData) {
  const household = await requireHousehold();
  const admin = createAdminClient();
  const id = formData.get("id") as string;

  const { data: item } = await admin
    .from("plaid_items")
    .select("access_token")
    .eq("id", id)
    .eq("household_id", household.householdId)
    .maybeSingle();

  if (item) {
    try {
      await createPlaidClient().itemRemove({ access_token: item.access_token });
    } catch {
      // Still remove our record even if Plaid's side fails (e.g. already revoked).
    }
  }

  await admin.from("plaid_items").delete().eq("id", id).eq("household_id", household.householdId);
  revalidatePath("/roundup");
}

export async function syncTransactions() {
  const household = await requireHousehold();
  const admin = createAdminClient();
  const client = createPlaidClient();

  const [{ data: items }, { data: settingsRow }] = await Promise.all([
    admin.from("plaid_items").select("*").eq("household_id", household.householdId),
    admin.from("roundup_settings").select("multiplier").eq("household_id", household.householdId).maybeSingle(),
  ]);

  const multiplier = Number(settingsRow?.multiplier ?? 2);

  for (const item of items ?? []) {
    // One broken connection (e.g. the bank needs you to log back in) used to throw here and
    // abort the whole sync before any *other* connected bank got a turn. Now it's caught,
    // flagged for the UI, and the loop moves on to the rest.
    try {
      let cursor: string | undefined = item.cursor ?? undefined;
      let hasMore = true;

      while (hasMore) {
        const response = await client.transactionsSync({
          access_token: item.access_token,
          cursor,
        });

        for (const txn of response.data.added) {
          // Plaid convention: a positive amount is money leaving the account (a purchase).
          if (txn.amount <= 0 || txn.pending) continue;

          await admin.from("roundup_purchases").insert({
            household_id: household.householdId,
            amount: txn.amount,
            round_up: calculateRoundUp(txn.amount, multiplier),
            source: "plaid",
            plaid_transaction_id: txn.transaction_id,
            merchant_name: txn.merchant_name ?? txn.name,
            purchased_at: txn.date,
          });
        }

        cursor = response.data.next_cursor;
        hasMore = response.data.has_more;
      }

      await admin.from("plaid_items").update({ cursor, needs_reauth: false }).eq("id", item.id);
    } catch {
      await admin.from("plaid_items").update({ needs_reauth: true }).eq("id", item.id);
    }
  }

  await notifyIfThresholdReached(household.householdId, household.householdName);

  revalidatePath("/roundup");
}
