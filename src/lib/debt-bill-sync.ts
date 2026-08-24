import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Next date (today counts) with this day-of-month, clamped to shorter months (e.g. 31st -> 28th in Feb). */
function nextMonthlyDate(day: number, from: Date): string {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const clampedDay = (y: number, m: number) => Math.min(day, new Date(y, m + 1, 0).getDate());

  let year = today.getFullYear();
  let month = today.getMonth();
  let candidate = new Date(year, month, clampedDay(year, month));

  if (candidate < today) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    candidate = new Date(year, month, clampedDay(year, month));
  }

  return format(candidate, "yyyy-MM-dd");
}

/** Next date (today counts) that falls on this weekday (0=Sunday..6=Saturday). */
function nextWeeklyDate(weekday: number, from: Date): string {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const diff = (weekday - today.getDay() + 7) % 7;
  const candidate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff);
  return format(candidate, "yyyy-MM-dd");
}

type Debt = {
  id: string;
  name: string;
  minimum_payment: number | null;
  payment_frequency: string;
  due_day: number | null;
  due_weekday: number | null;
};

/** Mirrors a debt's minimum payment into Budget as a linked bill, if it has an amount + due day/weekday.
 *  Returns `synced: false` (not an error) when the debt is missing what it needs to sync. */
export async function syncDebtBill(
  supabase: SupabaseClient,
  householdId: string,
  debt: Debt
): Promise<{ synced: boolean }> {
  if (!debt.minimum_payment || (!debt.due_day && debt.due_weekday === null)) return { synced: false };

  const now = new Date();
  const anchor =
    debt.payment_frequency === "monthly" ? nextMonthlyDate(debt.due_day!, now) : nextWeeklyDate(debt.due_weekday!, now);

  const { error } = await supabase.from("bills").insert({
    household_id: householdId,
    name: `${debt.name} Payment`,
    type: "expense",
    category: "Loan",
    amount: debt.minimum_payment,
    frequency: debt.payment_frequency,
    due_date: anchor,
    debt_id: debt.id,
  });

  if (error) throw new Error(error.message);
  return { synced: true };
}
