"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { WEEKDAYS } from "@/lib/weekdays";
import { addChore } from "./actions";

export type ChoreInitial = {
  title: string;
  assignedMemberIds: string[];
  frequency: string;
  daysOfWeek: number[] | null;
  points: number;
  dueDate: string | null;
};

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedMemberIds = new Set(initial?.assignedMemberIds ?? []);
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
      }
      onSaved?.();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {choreId && <input type="hidden" name="id" value={choreId} />}
      <input name="title" required defaultValue={initial?.title} placeholder="Chore (e.g. Take out trash)" className={inputClass} />
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-500">Who (pick one or more, or leave unassigned)</label>
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
