"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { WEEKDAYS } from "@/lib/weekdays";
import { addHabit } from "./actions";

export type HabitInitial = { name: string; emoji: string | null; daysOfWeek: number[] | null };

export default function HabitForm({
  initial,
  habitId,
  action = addHabit,
  onSaved,
}: {
  initial?: HabitInitial;
  habitId?: string;
  action?: (formData: FormData) => Promise<{ error: string } | { success: true }>;
  onSaved?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
      if (!habitId) form.reset();
      onSaved?.();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-[5rem_1fr]">
      {habitId && <input type="hidden" name="id" value={habitId} />}
      <input name="emoji" defaultValue={initial?.emoji ?? ""} maxLength={8} placeholder="🙂" aria-label="Emoji" className={`${inputClass} text-center`} />
      <input name="name" required defaultValue={initial?.name} placeholder="Habit (e.g. Walk 20 minutes)" className={inputClass} />
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-500">Which days? (leave blank for every day)</label>
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map((d) => (
            <label key={d.value} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="checkbox" name="days_of_week" value={d.value} defaultChecked={selectedDays.has(d.value)} className="accent-teal-600" />
              {d.label}
            </label>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <button type="submit" disabled={loading} className={`${buttonClass} sm:col-span-2`}>
        {loading ? "Saving…" : habitId ? "Save changes" : "Add habit"}
      </button>
    </form>
  );
}
