import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireAdult } from "@/lib/household";
import { CollapsibleCard, EmptyState, PageHeader } from "@/components/ui";
import { deleteBill, updateBill } from "../actions";
import AddBillForm from "../add-bill-form";
import BillRow from "./bill-row";

export default async function ManageBillsPage() {
  const household = await requireAdult();
  const supabase = await createClient();

  const { data: bills } = await supabase
    .from("bills")
    .select("*")
    .eq("household_id", household.householdId)
    .order("due_date");

  return (
    <div>
      <PageHeader
        title="Manage Bills"
        subtitle="This is your template — edit it once and every week/month in Budget is generated from it automatically."
      />

      <Link href="/budget" className="mb-6 inline-block text-sm text-teal-600 hover:underline">
        ← Back to this week
      </Link>

      <CollapsibleCard title="Add a bill" className="mb-8">
        <AddBillForm todayStr={format(new Date(), "yyyy-MM-dd")} />
      </CollapsibleCard>

      <h2 className="mb-3 text-sm font-semibold text-slate-700">All bills</h2>
      {!bills?.length ? (
        <EmptyState message="No bills set up yet — add one above." />
      ) : (
        <div className="space-y-2">
          {bills.map((b) => (
            <BillRow key={b.id} bill={b} updateBill={updateBill} deleteBill={deleteBill} />
          ))}
        </div>
      )}
    </div>
  );
}
