import { createClient } from "@/lib/supabase/server";
import { requireCaregiver } from "@/lib/household";
import { Card, CollapsibleCard, EmptyState, PageHeader, buttonClass, iconButtonClass, inputClass } from "@/components/ui";
import { addContact, deleteContact } from "./actions";

const CATEGORIES = ["medical", "family", "school", "work", "utility", "other"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  medical: "🏥 Medical",
  family: "👪 Family",
  school: "🏫 School",
  work: "💼 Work",
  utility: "🔌 Utility",
  other: "📌 Other",
};

export default async function ContactsPage() {
  const household = await requireCaregiver();
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("emergency_contacts")
    .select("*")
    .eq("household_id", household.householdId)
    .order("category")
    .order("name");

  const grouped = new Map<string, typeof contacts>();
  for (const c of contacts ?? []) {
    if (!grouped.has(c.category)) grouped.set(c.category, []);
    grouped.get(c.category)!.push(c);
  }

  return (
    <div>
      <PageHeader title="Emergency Contacts" subtitle="Doctors, school, family, and other important numbers." />

      <CollapsibleCard title="Add a contact" className="mb-8">
        <form action={addContact} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input name="name" required placeholder="Name" className={inputClass} />
          <input name="relationship" placeholder="Relationship (e.g. Pediatrician)" className={inputClass} />
          <select name="category" className={inputClass} defaultValue="other">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <input name="phone" placeholder="Phone" className={inputClass} />
          <input name="email" placeholder="Email" className={inputClass} />
          <input name="notes" placeholder="Notes" className={inputClass} />
          <button type="submit" className={`${buttonClass} sm:col-span-2`}>
            Add contact
          </button>
        </form>
      </CollapsibleCard>

      {!contacts?.length ? (
        <EmptyState message="No contacts yet — add your first one above." />
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category}>
              <h3 className="mb-2 text-sm font-semibold text-slate-500">{CATEGORY_LABELS[category]}</h3>
              <div className="space-y-2">
                {items!.map((c) => (
                  <Card key={c.id} className="flex items-center justify-between !p-4">
                    <div>
                      <p className="font-medium text-slate-900">{c.name}</p>
                      <p className="text-sm text-slate-500">
                        {[c.relationship, c.phone, c.email].filter(Boolean).join(" · ")}
                      </p>
                      {c.notes && <p className="text-xs text-slate-400">{c.notes}</p>}
                    </div>
                    <form action={deleteContact}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className={iconButtonClass}>Remove</button>
                    </form>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
