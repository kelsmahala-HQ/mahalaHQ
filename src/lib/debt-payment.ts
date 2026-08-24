import type { SupabaseClient } from "@supabase/supabase-js";

/** Logs a payment against a debt and reduces its current balance. Shared by manual logging and the round-up payout. */
export async function applyDebtPayment(
  supabase: SupabaseClient,
  debtId: string,
  amount: number,
  options?: { note?: string; paidOn?: string }
) {
  const { error: paymentError } = await supabase.from("debt_payments").insert({
    debt_id: debtId,
    amount,
    paid_on: options?.paidOn || new Date().toISOString().slice(0, 10),
    note: options?.note,
  });
  if (paymentError) throw new Error(paymentError.message);

  const { data: debt, error: fetchError } = await supabase.from("debts").select("current_balance").eq("id", debtId).single();
  if (fetchError) throw new Error(fetchError.message);
  if (debt) {
    const newBalance = Math.max(0, Number(debt.current_balance) - amount);
    const { error: updateError } = await supabase.from("debts").update({ current_balance: newBalance }).eq("id", debtId);
    if (updateError) throw new Error(updateError.message);
  }
}
