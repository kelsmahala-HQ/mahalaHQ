import { createClient } from "@/lib/supabase/server";
import { requireCaregiver } from "@/lib/household";
import { CollapsibleCard, EmptyState, PageHeader } from "@/components/ui";
import { getAvatarUrl } from "./actions";
import ProfileCard from "./profile-card";
import AddProfileForm from "./add-profile-form";

function calculateAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default async function FamilyPage() {
  const household = await requireCaregiver();
  const isSitter = household.role === "sitter";
  const supabase = await createClient();
  const [{ data: profiles }, { data: members }] = await Promise.all([
    supabase.from("family_profiles").select("*").eq("household_id", household.householdId).order("member_name"),
    supabase.from("household_members").select("id, display_name").eq("household_id", household.householdId).order("display_name"),
  ]);

  // Sitters only need the kids' info (doctor, allergies, schedule, etc.) -- an adult family
  // member's own profile isn't something a sitter has a reason to see. Filtered here, before
  // it's ever sent to the client, not just hidden in the UI.
  const visibleProfiles = isSitter ? (profiles ?? []).filter((p) => { const age = calculateAge(p.date_of_birth); return age === null || age < 18; }) : (profiles ?? []);

  const profilesWithAvatars = await Promise.all(
    visibleProfiles.map(async (p) => ({
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

      <CollapsibleCard title="Add a family member" className="mb-8">
        <AddProfileForm members={members ?? []} />
      </CollapsibleCard>

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
