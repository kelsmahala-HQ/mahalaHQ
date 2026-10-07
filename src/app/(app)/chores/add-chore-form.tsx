"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { WEEKDAYS } from "@/lib/weekdays";
import { addChore } from "./actions";

export type ChoreInitial = {
  title: string;
  assignedMemberIds: string[];
  eligibleMemberIds: string[];
  frequency: string;
  daysOfWeek: number[] | null;
  points: number;
  dueDate: string | null;
  creditWhoeverCompletes?: boolean;
};

function sameMembers(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/**
 * By default who can claim a chore just mirrors who it's assigned to (assign it to Luke only ->
 * only Luke sees it; assign it to nobody -> it's open to everyone). "Custom access" is only for
 * the exception: a chore assigned to Luke that others can also pinch-hit on, or a chore with no
 * assignee that's still limited to a few people (Clean Porch). We only need to show that second
 * picker when the chore is actually in that exception state.
 */
function hasCustomEligibility(assignedIds: string[], eligibleIds: string[]): boolean {
  if (eligibleIds.length === 0) return assignedIds.length > 0; // "everyone" despite having an assignee is a deliberate override
  return !sameMembers(assignedIds, eligibleIds);
}

export default function AddChoreForm({
  members,
  initial,
  choreId,
  action = addChore,
  onSaved,
}: {
  members: { id: string; display_name: string }[];
  initial?: ChoreInitial;
  choreId?: string;
  action?: (formData: FormData) => Promise<{ error: string } | { success: true }>;
  onSaved?: () => void;
}) {
  const [frequency, setFrequency] = useState(initial?.frequency ?? "weekly");
  const [customEligibility, setCustomEligibility] = useState(
    hasCustomEligibility(initial?.assignedMemberIds ?? [], initial?.eligibleMemberIds ?? [])
  );
  const [anyoneEligible, setAnyoneEligible] = useState((initial?.eligibleMemberIds?.length ?? 0) === 0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedMemberIds = new Set(initial?.assignedMemberIds ?? []);
  const selectedEligibleIds = new Set(initial?.eligibleMemberIds ?? []);
  const selectedDays = new Set(initial?.daysOfWeek ?? []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);

    const result = await action(new FormData(form));

    setLoading(false);
    if ("error" in result) setError(result.error);
    else {
      if (!choreId) {
        form.reset();
        setFrequency("weekly");
        setCustomEligibility(false);
        setAnyoneEligible(true);
      }
      onSaved?.();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {choreId && <input type="hidden" name="id" value={choreId} />}
      <input name="title" required defaultValue={initial?.title} placeholder="Chore (e.g. Take out trash)" className={inputClass} />
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Who does this chore? (leave everyone unchecked for an open chore anyone in the house can do)
        </label>
        <div className="flex flex-wrap gap-3">
          {members?.map((m) => (
            <label key={m.id} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="checkbox"
                name="assigned_member_id"
                value={m.id}
                defaultChecked={selectedMemberIds.has(m.id)}
                className="accent-teal-600"
              />
              {m.display_name}
            </label>
          ))}
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          Only the people picked here can see it and mark it done — unless you turn on custom access below.
        </p>
        <label className="mt-2 flex items-center gap-1.5 text-sm text-slate-700">
          <input
            type="checkbox"
            name="credit_whoever_completes"
            defaultChecked={initial?.creditWhoeverCompletes ?? false}
            className="accent-teal-600"
          />
          Alternating chore — only whoever marks it done gets the points
        </label>
        <p className="mt-0.5 text-xs text-slate-400">
          Leave unchecked for a shared job (e.g. moving the couch together) where everyone assigned gets full credit
          every time.
        </p>
      </div>

      <div className="sm:col-span-2">
        {!customEligibility ? (
          <button
            type="button"
            onClick={() => setCustomEligibility(true)}
            className="text-xs font-medium text-teal-600 hover:text-teal-500"
          >
            + Let different people claim this
          </button>
        ) : (
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-slate-600">Who can actually claim it (independent of who it&rsquo;s assigned to)</p>
              <button
                type="button"
                onClick={() => setCustomEligibility(false)}
                className="text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                Match assignment
              </button>
            </div>
            <input type="hidden" name="eligibility_mode" value="custom" />
            <label className="mb-2 flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={anyoneEligible}
                onChange={(e) => setAnyoneEligible(e.target.checked)}
                className="accent-teal-600"
              />
              Anyone in the house
            </label>
            {!anyoneEligible && (
              <div className="flex flex-wrap gap-3">
                {members?.map((m) => (
                  <label key={m.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="eligible_member_id"
                      value={m.id}
                      defaultChecked={selectedEligibleIds.has(m.id)}
                      className="accent-teal-600"
                    />
                    {m.display_name}
                  </label>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-slate-400">
              E.g. &ldquo;Mow the lawn&rdquo; is assigned to Luke but Kelsey can pinch-hit too; or &ldquo;Clean
              porch&rdquo; has no assignee and is just open to a couple of people, first to finish it gets the points.
            </p>
          </div>
        )}
      </div>

      <select name="frequency" className={inputClass} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
        <option value="once">One-time</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
      <input name="points" type="number" min={0} defaultValue={initial?.points || undefined} placeholder="Points (optional)" className={inputClass} />
      {frequency === "weekly" && (
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Repeat on specific days (optional — leave blank for every 7 days)</label>
          <div className="flex flex-wrap gap-3">
            {WEEKDAYS.map((d) => (
              <label key={d.value} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="days_of_week"
                  value={d.value}
                  defaultChecked={selectedDays.has(d.value)}
                  className="accent-teal-600"
                />
                {d.label}
              </label>
            ))}
          </div>
        </div>
      )}
      <input name="due_date" type="date" defaultValue={initial?.dueDate ?? undefined} className={inputClass} />
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <button type="submit" disabled={loading} className={`${buttonClass} sm:col-span-2`}>
        {loading ? "Saving..." : choreId ? "Save changes" : "Add chore"}
      </button>
    </form>
  );
}
