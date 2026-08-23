import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CurrentHousehold } from "@/lib/household";
import { Card, PageHeader } from "@/components/ui";

export default async function SitterDashboard({ household }: { household: CurrentHousehold }) {
  const supabase = await createClient();
  const now = new Date();

  const [{ data: events }, { data: profiles }, { data: contacts }] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("*")
      .eq("household_id", household.householdId)
      .gte("start_at", now.toISOString())
      .lte("start_at", new Date(now.getTime() + 3 * 86400000).toISOString())
      .order("start_at")
      .limit(8),
    supabase
      .from("family_profiles")
      .select("member_name, allergies")
      .eq("household_id", household.householdId)
      .not("allergies", "is", null)
      .neq("allergies", ""),
    supabase
      .from("emergency_contacts")
      .select("*")
      .eq("household_id", household.householdId)
      .eq("category", "medical")
      .limit(3),
  ]);

  return (
    <div>
      <PageHeader title={`Hi ${household.displayName}!`} subtitle={`Everything you need for ${household.householdName}.`} />

      {!!profiles?.length && (
        <Card className="mb-6 !bg-red-50">
          <p className="mb-1 text-sm font-semibold text-red-800">⚠️ Allergies to know about</p>
          <ul className="space-y-1 text-sm text-red-700">
            {profiles.map((p) => (
              <li key={p.member_name}>
                <strong>{p.member_name}:</strong> {p.allergies}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/family" className="block">
          <Card className="flex items-center gap-3 hover:bg-teal-50">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-lg">👨‍👩‍👧‍👦</span>
            <div>
              <p className="font-medium text-slate-900">Family Info</p>
              <p className="text-xs text-slate-400">Schedules, doctors, sizes</p>
            </div>
          </Card>
        </Link>
        <Link href="/contacts" className="block">
          <Card className="flex items-center gap-3 hover:bg-yellow-50">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-lg">🚨</span>
            <div>
              <p className="font-medium text-slate-900">Emergency Contacts</p>
              <p className="text-xs text-slate-400">Doctors, family, more</p>
            </div>
          </Card>
        </Link>
      </div>

      {!!contacts?.length && (
        <Card className="mb-6">
          <p className="mb-2 text-sm font-semibold text-slate-700">Quick medical contacts</p>
          <ul className="space-y-1 text-sm">
            {contacts.map((c) => (
              <li key={c.id} className="flex justify-between">
                <span className="text-slate-900">{c.name}</span>
                <span className="text-slate-500">{c.phone}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Next few days</h2>
          <Link href="/calendar" className="text-xs text-teal-600 hover:underline">
            View calendar
          </Link>
        </div>
        {!events?.length ? (
          <p className="text-sm text-slate-400">Nothing on the calendar.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                <span className="text-slate-400">
                  {new Date(e.start_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </span>
                <span className="text-slate-900">{e.title}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
