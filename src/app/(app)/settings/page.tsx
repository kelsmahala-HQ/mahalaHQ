import { createClient } from "@/lib/supabase/server";
import { requireAdult } from "@/lib/household";
import { Card, PageHeader, inputClass } from "@/components/ui";
import { updateMemberName, updateMemberPhone, updateMemberRole } from "./actions";
import InviteEmailForm from "./invite-email-form";
import PushToggle from "./push-toggle";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  adult: "Adult",
  kid: "Kid",
  sitter: "Sitter",
};

export default async function SettingsPage() {
  const household = await requireAdult();
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("household_members")
    .select("id, display_name, role, phone")
    .eq("household_id", household.householdId)
    .order("display_name");

  return (
    <div>
      <PageHeader
        title="Household Members"
        subtitle="Kid accounts only see Chores, Calendar, and Groceries. Sitter accounts only see Family Info, Emergency Contacts, and the Calendar — no financial or household-management pages."
      />

      <Card className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">🔔 Notifications</h2>
        <p className="mb-3 text-sm text-slate-500">
          Get an alert on this device for calendar reminders (a day before and 2 hours before) and when a chore is
          assigned to you. This has to be turned on separately on each device/browser you use.
        </p>
        <PushToggle />
      </Card>

      <Card className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Invite a family member</h2>
        <InviteEmailForm />
        <p className="mt-2 text-xs text-slate-400">
          Or share the invite code directly from the sidebar — invite code: <strong>{household.inviteCode}</strong>
        </p>
      </Card>

      <Card>
        <div className="space-y-4">
          {members?.map((m) => {
            const isSelf = m.id === household.memberId;
            return (
              <div key={m.id} className="rounded-lg bg-slate-50 px-3 py-3">
                <div className="mb-2">
                  {isSelf || household.role === "admin" ? (
                    <form action={updateMemberName} className="flex items-center gap-2">
                      <input type="hidden" name="member_id" value={m.id} />
                      <input
                        name="display_name"
                        required
                        defaultValue={m.display_name}
                        className={`${inputClass} w-48 !py-1 text-sm font-medium`}
                      />
                      {isSelf && <span className="text-xs text-slate-400">(you)</span>}
                      <button type="submit" className="rounded-lg bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100">
                        Save
                      </button>
                    </form>
                  ) : (
                    <p className="text-sm font-medium text-slate-900">{m.display_name}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Role:</span>
                  {household.role === "admin" && !isSelf ? (
                    <form action={updateMemberRole} className="flex items-center gap-2">
                      <input type="hidden" name="member_id" value={m.id} />
                      <select name="role" defaultValue={m.role} className="rounded-lg border border-slate-300 px-2 py-1 text-sm">
                        <option value="admin">Admin</option>
                        <option value="adult">Adult</option>
                        <option value="kid">Kid</option>
                        <option value="sitter">Sitter</option>
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

                <div className="mt-2">
                  {isSelf || household.role === "admin" ? (
                    <form action={updateMemberPhone} className="flex items-center gap-2">
                      <input type="hidden" name="member_id" value={m.id} />
                      <input
                        name="phone"
                        type="tel"
                        defaultValue={m.phone ?? ""}
                        placeholder={isSelf ? "Your phone number" : `${m.display_name}'s phone number`}
                        className={`${inputClass} w-48 !py-1 text-sm`}
                      />
                      <button type="submit" className="rounded-lg bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100">
                        Save
                      </button>
                    </form>
                  ) : (
                    <p className="text-xs text-slate-400">{m.phone || "No phone number on file"}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
