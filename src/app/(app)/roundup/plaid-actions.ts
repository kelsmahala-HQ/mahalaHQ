"use server";

import { revalidatePath } from "next/cache";
import { CountryCode, Products } from "plaid";
import { requireHousehold } from "@/lib/household";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPlaidClient } from "@/lib/plaid";
import { calculateRoundUp } from "@/lib/roundup";

export async function createLinkToken(): Promise<{ linkToken: string } | { error: string }> {
  const household = await requireHousehold();
  const client = createPlaidClient();

  try {
    const response = await client.linkTokenCreate({
      user: { client_user_id: household.householdId },
      client_name: "Family Portal",
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
    const response = await client.itemPublicTokenExchange({ public_token: publicToken });
    await admin.from("plaid_items").insert({
      household_id: household.householdId,
      item_id: response.data.item_id,
      access_token: response.data.access_token,
      institution_name: institutionName,
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
        });
      }

      cursor = response.data.next_cursor;
      hasMore = response.data.has_more;
    }

    await admin.from("plaid_items").update({ cursor }).eq("id", item.id);
  }

  revalidatePath("/roundup");
}
