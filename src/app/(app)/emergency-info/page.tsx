import { createClient } from "@/lib/supabase/server";
import { requireAdult } from "@/lib/household";
import { CollapsibleCard, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { addSection, ensureSeeded } from "./actions";
import SectionCard from "./section-card";

export default async function EmergencyInfoPage() {
  const household = await requireAdult();
  await ensureSeeded(household.householdId);

  const supabase = await createClient();
  const { data: sections } = await supabase
    .from("emergency_info_sections")
    .select("id, title, body")
    .eq("household_id", household.householdId)
    .order("position");

  return (
    <div>
      <PageHeader
        title="🆘 In Case of Emergency"
        subtitle="Not passwords — just where things are and what to do. For actual account access, set up Emergency Access in your password manager (e.g. 1Password) separately."
      />

      <div className="mb-6 space-y-3">
        {(sections ?? []).map((s) => (
          <SectionCard key={s.id} section={s} />
        ))}
      </div>

      <CollapsibleCard title="+ Add a section">
        <form action={addSection} className="space-y-2">
          <input name="title" required placeholder="Section title (e.g. Safe Deposit Box)" className={inputClass} />
          <textarea name="body" placeholder="Details..." rows={4} className={inputClass} />
          <button type="submit" className={buttonClass}>
            Add section
          </button>
        </form>
      </CollapsibleCard>
    </div>
  );
}
