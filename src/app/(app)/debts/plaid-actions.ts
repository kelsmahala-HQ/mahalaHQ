"use server";

import { revalidatePath } from "next/cache";
import { requireAdult } from "@/lib/household";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPlaidClient } from "@/lib/plaid";

type LiabilityAccount = {
  accountId: string;
  name: string;
  currentBalance: number | null;
  interestRate: number | null;
  minimumPayment: number | null;
};

export async function syncLiabilities(): Promise<{ error: string } | { success: true; synced: number }> {
  const household = await requireAdult();
  const admin = createAdminClient();
  const client = createPlaidClient();

  const { data: items } = await admin.from("plaid_items").select("*").eq("household_id", household.householdId);
  if (!items?.length) return { error: "Connect a bank on the Round-Up page first." };

  const accounts: LiabilityAccount[] = [];

  for (const item of items) {
    try {
      const response = await client.liabilitiesGet({ access_token: item.access_token });
      const balancesByAccount = new Map(response.data.accounts.map((a) => [a.account_id, a.balances.current]));

      for (const c of response.data.liabilities?.credit ?? []) {
        const apr = c.aprs?.find((a) => a.apr_type === "purchase_apr")?.apr_percentage ?? c.aprs?.[0]?.apr_percentage;
        accounts.push({
          accountId: c.account_id!,
          name: response.data.accounts.find((a) => a.account_id === c.account_id)?.name ?? "Credit card",
          currentBalance: balancesByAccount.get(c.account_id!) ?? null,
          interestRate: apr ?? null,
          minimumPayment: c.minimum_payment_amount ?? null,
        });
      }

      for (const s of response.data.liabilities?.student ?? []) {
        accounts.push({
          accountId: s.account_id!,
          name: response.data.accounts.find((a) => a.account_id === s.account_id)?.name ?? "Student loan",
          currentBalance: balancesByAccount.get(s.account_id!) ?? null,
          interestRate: s.interest_rate_percentage ?? null,
          minimumPayment: s.minimum_payment_amount ?? null,
        });
      }

      for (const m of response.data.liabilities?.mortgage ?? []) {
        accounts.push({
          accountId: m.account_id!,
          name: response.data.accounts.find((a) => a.account_id === m.account_id)?.name ?? "Mortgage",
          currentBalance: balancesByAccount.get(m.account_id!) ?? null,
          interestRate: m.interest_rate?.percentage ?? null,
          minimumPayment: m.next_monthly_payment ? Number(m.next_monthly_payment) : null,
        });
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Could not fetch balances from your bank." };
    }
  }

  let synced = 0;
  for (const acc of accounts) {
    if (acc.currentBalance === null) continue;

    const { data: existing } = await admin.from("debts").select("id").eq("plaid_account_id", acc.accountId).maybeSingle();

    if (existing) {
      await admin
        .from("debts")
        .update({
          current_balance: acc.currentBalance,
          interest_rate: acc.interestRate,
          minimum_payment: acc.minimumPayment,
        })
        .eq("id", existing.id);
    } else {
      await admin.from("debts").insert({
        household_id: household.householdId,
        name: acc.name,
        current_balance: acc.currentBalance,
        original_balance: acc.currentBalance,
        interest_rate: acc.interestRate,
        minimum_payment: acc.minimumPayment,
        plaid_account_id: acc.accountId,
      });
    }
    synced++;
  }

  revalidatePath("/debts");
  return { success: true, synced };
}
