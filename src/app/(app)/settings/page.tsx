import { createClient } from "@/lib/supabase/server";
import { requireAdult } from "@/lib/household";
import { Card, PageHeader } from "@/components/ui";
import { updateMemberRole } from "./actions";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  adult: "Adult",
  kid: "Kid",
};

export default async function SettingsPage() {
  const household = await requireAdult();
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("household_members")
    .select("id, display_name, role")
    .eq("household_id", household.householdId)
    .order("display_name");

  return (
    <div>
      <PageHeader title="Household Members" subtitle="Kid accounts only see Chores, Calendar, and Groceries — everything else is hidden." />

      <Card>
        <div className="space-y-3">
          {members?.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {m.display_name}
                  {m.id === household.memberId && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                </p>
              </div>

              {household.role === "admin" && m.id !== household.memberId ? (
                <form action={updateMemberRole} className="flex items-center gap-2">
                  <input type="hidden" name="member_id" value={m.id} />
                  <select name="role" defaultValue={m.role} className="rounded-lg border border-slate-300 px-2 py-1 text-sm">
                    <option value="admin">Admin</option>
                    <option value="adult">Adult</option>
                    <option value="kid">Kid</option>
                  </select>
                  <button type="submit" className="rounded-lg bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100">
                    Save
                  </button>
                </form>
              ) : (
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">
                  {ROLE_LABELS[m.role] ?? m.role}
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
