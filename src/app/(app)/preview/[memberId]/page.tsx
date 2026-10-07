import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdult } from "@/lib/household";
import KidDashboard from "../../dashboard/kid-dashboard";

/**
 * A read-only look at a kid's dashboard, for admins/adults. It renders the real kid dashboard
 * with that member's identity, so what's here is exactly what they see -- but the whole thing is
 * inert, so nothing on it can be clicked and no action (Done, Skip, Redeem) can fire as you.
 */
export default async function PreviewAsKidPage({ params }: { params: Promise<{ memberId: string }> }) {
  const household = await requireAdult();
  const { memberId } = await params;
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("household_members")
    .select("id, display_name, role")
    .eq("id", memberId)
    .eq("household_id", household.householdId)
    .maybeSingle();
  if (!member || member.role !== "kid") notFound();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span>
          <span className="font-semibold">Preview:</span> this is what {member.display_name} sees on her dashboard. Buttons are turned off here.
        </span>
        <Link href="/grades" className="font-medium text-amber-900 underline">
          Back to Grades
        </Link>
      </div>
      <div inert className="pointer-events-none select-none">
        <KidDashboard household={{ ...household, memberId: member.id, displayName: member.display_name, role: "kid" }} />
      </div>
    </div>
  );
}
