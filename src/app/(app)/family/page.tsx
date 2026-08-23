import { createClient } from "@/lib/supabase/server";
import { requireCaregiver } from "@/lib/household";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { getAvatarUrl } from "./actions";
import ProfileCard from "./profile-card";
import AddProfileForm from "./add-profile-form";

export default async function FamilyPage() {
  const household = await requireCaregiver();
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

  const membersById = new Map((members ?? []).map((m) => [m.id, m.display_name]));
  const linkedMemberIds = new Set(profilesWithAvatars.map((p) => p.member_id).filter(Boolean));

  return (
    <div>
      <PageHeader
        title="Family Info"
        subtitle="School, doctor, schedules, clothing sizes — everything about each family member in one place."
      />

      <Card className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Add a family member</h2>
        <AddProfileForm members={members ?? []} />
      </Card>

      {!profilesWithAvatars.length ? (
        <EmptyState message="No family members yet — add one above, then fill in details." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {profilesWithAvatars.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              isYou={p.member_id === household.memberId}
              linkedDisplayName={p.member_id ? membersById.get(p.member_id) ?? null : null}
              availableMembers={(members ?? []).filter((m) => m.id === p.member_id || !linkedMemberIds.has(m.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
