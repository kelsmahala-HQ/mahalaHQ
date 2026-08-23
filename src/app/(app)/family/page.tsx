import { createClient } from "@/lib/supabase/server";
import { requireAdult } from "@/lib/household";
import { Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { addProfile, getAvatarUrl } from "./actions";
import ProfileCard from "./profile-card";

export default async function FamilyPage() {
  const household = await requireAdult();
  const supabase = await createClient();
  const [{ data: profiles }, { data: members }] = await Promise.all([
    supabase.from("family_profiles").select("*").eq("household_id", household.householdId).order("member_name"),
    supabase.from("household_members").select("id, display_name").eq("household_id", household.householdId).order("display_name"),
  ]);

  const profilesWithAvatars = await Promise.all(
    (profiles ?? []).map(async (p) => ({
      ...p,
      avatarUrl: p.avatar_path ? await getAvatarUrl(p.avatar_path) : null,
    }))
  );

  return (
    <div>
      <PageHeader
        title="Family Info"
        subtitle="School, doctor, schedules, clothing sizes — everything about each family member in one place."
      />

      <Card className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Add a family member</h2>
        <form action={addProfile} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input name="member_name" required placeholder="Name" className={inputClass} />
          <input name="date_of_birth" type="date" className={inputClass} />
          <select name="member_id" defaultValue="" className={`${inputClass} sm:col-span-2`}>
            <option value="">Not linked to a login (e.g. a baby, or add details before they sign up)</option>
            {members?.map((m) => (
              <option key={m.id} value={m.id}>
                Link to {m.display_name}&rsquo;s login
              </option>
            ))}
          </select>
          <button type="submit" className={`${buttonClass} sm:col-span-2`}>
            Add family member
          </button>
        </form>
      </Card>

      {!profilesWithAvatars.length ? (
        <EmptyState message="No family members yet — add one above, then fill in details." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {profilesWithAvatars.map((p) => (
            <ProfileCard key={p.id} profile={p} isYou={p.member_id === household.memberId} />
          ))}
        </div>
      )}
    </div>
  );
}
