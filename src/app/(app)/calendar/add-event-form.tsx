"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { addEvent } from "./actions";
import { EVENT_TYPES } from "./event-types";
import HighlightPicker from "./highlight-picker";

export default function AddEventForm({
  todayStr,
  members,
}: {
  todayStr: string;
  members: { id: string; member_name: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);

    const result = await addEvent(new FormData(form));

    setLoading(false);
    if ("error" in result) setError(result.error);
    else form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input name="title" required placeholder="Event title" className={inputClass} />
      <select name="assigned_member_id" defaultValue="" className={inputClass}>
        <option value="">Whole family</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.member_name}
          </option>
        ))}
      </select>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Date</label>
        <input name="date" type="date" required defaultValue={todayStr} className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Time (leave blank for all-day)</label>
        <input name="time" type="time" className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">End time (optional)</label>
        <input name="end_time" type="time" className={inputClass} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Type</label>
        <select name="event_type" defaultValue="general" className={inputClass}>
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.icon ? `${t.icon} ` : ""}
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Repeat</label>
        <select name="recurrence" defaultValue="none" className={inputClass}>
          <option value="none">Does not repeat</option>
          <option value="daily">Repeats daily</option>
          <option value="weekly">Repeats weekly</option>
          <option value="monthly">Repeats monthly</option>
          <option value="yearly">Repeats yearly (e.g. birthdays)</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Repeat until (leave blank for forever)</label>
        <input name="recurrence_end" type="date" className={inputClass} />
      </div>
      <input name="location" placeholder="Location (optional)" className={inputClass} />
      <div className="sm:col-span-2">
        <HighlightPicker />
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <button type="submit" disabled={loading} className={`${buttonClass} sm:col-span-2`}>
        {loading ? "Adding..." : "Add event"}
      </button>
    </form>
  );
}
