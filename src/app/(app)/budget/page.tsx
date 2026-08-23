import { endOfWeek, format, startOfWeek } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireAdult } from "@/lib/household";
import { Card, EmptyState, PageHeader, buttonClass, iconButtonClass, inputClass } from "@/components/ui";
import { addCategory, addTransaction, deleteCategory, deleteTransaction, updateCategoryLimit } from "./actions";

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// Pay periods run Saturday -> Friday, so a period starts the day after payday and ends on the next one.
const PAY_PERIOD_OPTS = { weekStartsOn: 6 as const };

export default async function BudgetPage() {
  const household = await requireAdult();
  const supabase = await createClient();

  const now = new Date();
  const periodStartDate = startOfWeek(now, PAY_PERIOD_OPTS);
  const periodEndDate = endOfWeek(now, PAY_PERIOD_OPTS);
  const periodStart = format(periodStartDate, "yyyy-MM-dd");
  const periodEnd = format(periodEndDate, "yyyy-MM-dd");

  const [{ data: categories }, { data: transactions }] = await Promise.all([
    supabase.from("budget_categories").select("*").eq("household_id", household.householdId).order("name"),
    supabase
      .from("budget_transactions")
      .select("*, budget_categories(name, type)")
      .eq("household_id", household.householdId)
      .gte("occurred_on", periodStart)
      .lte("occurred_on", periodEnd)
      .order("occurred_on", { ascending: false }),
  ]);

  const spentByCategory = new Map<string, number>();
  let totalIncome = 0;
  let totalExpense = 0;
  for (const t of transactions ?? []) {
    if (t.category_id) spentByCategory.set(t.category_id, (spentByCategory.get(t.category_id) ?? 0) + Number(t.amount));
    const type = (t.budget_categories as unknown as { type?: string } | null)?.type;
    if (type === "income") totalIncome += Number(t.amount);
    else totalExpense += Number(t.amount);
  }

  const totalAllocated = (categories ?? [])
    .filter((c) => c.type === "expense" && c.monthly_limit)
    .reduce((sum, c) => sum + Number(c.monthly_limit), 0);
  const unallocated = totalIncome - totalAllocated;

  return (
    <div>
      <PageHeader
        title="Budget"
        subtitle={`This pay period: ${format(periodStartDate, "MMM d")} – ${format(periodEndDate, "MMM d, yyyy")} (Sat–Fri, aligned to payday)`}
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase text-slate-400">Income</p>
          <p className="mt-1 text-2xl font-semibold text-teal-600">{currency(totalIncome)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-slate-400">Expenses</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{currency(totalExpense)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-slate-400">Net</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{currency(totalIncome - totalExpense)}</p>
        </Card>
        <Card className={unallocated < 0 ? "!bg-red-50" : "!bg-yellow-50"}>
          <p className="text-xs font-medium uppercase text-slate-400">Unallocated</p>
          <p className={`mt-1 text-2xl font-semibold ${unallocated < 0 ? "text-red-600" : "text-slate-900"}`}>
            {currency(unallocated)}
          </p>
        </Card>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Add category</h2>
          <form action={addCategory} className="grid grid-cols-1 gap-3">
            <input name="name" required placeholder="Category (e.g. Groceries)" className={inputClass} />
            <select name="type" defaultValue="expense" className={inputClass}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <input name="monthly_limit" type="number" step="0.01" placeholder="Budget for this pay period (optional)" className={inputClass} />
            <button type="submit" className={buttonClass}>
              Add category
            </button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Log a transaction</h2>
          <form action={addTransaction} className="grid grid-cols-1 gap-3">
            <select name="category_id" className={inputClass} defaultValue="">
              <option value="">No category</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input name="amount" type="number" step="0.01" required placeholder="Amount" className={inputClass} />
            <input name="description" placeholder="Description" className={inputClass} />
            <input name="occurred_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
            <button type="submit" className={buttonClass}>
              Add transaction
            </button>
          </form>
        </Card>
      </div>

      {categories?.length ? (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Categories</h2>
          <p className="mb-3 text-xs text-slate-400">
            Set each category&rsquo;s budget for <em>this</em> pay period — since Luke&rsquo;s and your paychecks aren&rsquo;t always the
            same amount, adjust these as needed rather than expecting one number to fit every period.
          </p>
          <div className="space-y-2">
            {categories.map((c) => {
              const spent = spentByCategory.get(c.id) ?? 0;
              const limit = c.monthly_limit ? Number(c.monthly_limit) : null;
              const pct = limit ? Math.min(100, Math.round((spent / limit) * 100)) : null;
              return (
                <Card key={c.id} className="!p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">
                        {c.name} <span className="text-xs font-normal text-slate-400">({c.type})</span>
                      </p>
                      <p className="text-sm text-slate-500">
                        {currency(spent)} {limit ? `of ${currency(limit)}` : "spent this period"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <form action={updateCategoryLimit} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={c.id} />
                        <input
                          name="monthly_limit"
                          type="number"
                          step="0.01"
                          defaultValue={c.monthly_limit ?? ""}
                          placeholder="Budget"
                          className={`${inputClass} w-24 !py-1 text-sm`}
                        />
                        <button type="submit" className="rounded-lg bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100">
                          Save
                        </button>
                      </form>
                      <form action={deleteCategory}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className={iconButtonClass}>Remove</button>
                      </form>
                    </div>
                  </div>
                  {pct !== null && (
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                      <div
                        className={`h-1.5 rounded-full ${pct >= 100 ? "bg-red-500" : "bg-teal-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState message="No budget categories yet." />
      )}

      <h2 className="mb-3 text-sm font-semibold text-slate-700">Transactions this pay period</h2>
      {!transactions?.length ? (
        <EmptyState message="No transactions logged this pay period." />
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <Card key={t.id} className="flex items-center justify-between !p-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {t.description || (t.budget_categories as unknown as { name?: string })?.name || "Transaction"}
                </p>
                <p className="text-xs text-slate-400">
                  {t.occurred_on} · {(t.budget_categories as unknown as { name?: string })?.name ?? "Uncategorized"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-900">{currency(Number(t.amount))}</span>
                <form action={deleteTransaction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className={iconButtonClass}>Remove</button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
