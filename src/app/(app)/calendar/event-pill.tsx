"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { buttonClass, inputClass } from "@/components/ui";
import { wallClockDate } from "@/lib/wall-clock";
import { EVENT_TYPES } from "./event-types";

type EventData = {
  id: string;
  occurrenceKey: string;
  title: string;
  location: string | null;
  assigned_to: string | null;
  assigned_member_id: string | null;
  start_at: string;
  end_at: string | null;
  anchorStartAt: string;
  all_day: boolean;
  color: string;
  recurrence: string;
  recurrence_end: string | null;
  event_type: string;
  age: number | null;
};

type Props = {
  event: EventData;
  icon: string;
  members: { id: string; member_name: string }[];
  deleteEvent: (formData: FormData) => void;
  updateEvent: (formData: FormData) => Promise<{ error: string } | { success: true }>;
};

export default function EventPill({ event, icon, members, deleteEvent, updateEvent }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const anchor = wallClockDate(event.anchorStartAt);
  const dateStr = format(anchor, "yyyy-MM-dd");
  const timeStr = event.all_day ? "" : format(anchor, "HH:mm");
  const endTimeStr = event.end_at ? format(wallClockDate(event.end_at), "HH:mm") : "";

  function close() {
    dialogRef.current?.close();
    setEditing(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set("id", event.id);
    const result = await updateEvent(formData);

    setLoading(false);
    if ("error" in result) setError(result.error);
    else close();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        title="Click to view details"
        className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white"
        style={{ backgroundColor: event.color }}
      >
        {event.recurrence !== "none" ? "↻ " : ""}
        {icon ? `${icon} ` : ""}
        {event.all_day ? "" : format(wallClockDate(event.start_at), "h:mma ")}
        {event.title}
        {event.age ? ` (turns ${event.age})` : ""}
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        onClose={() => setEditing(false)}
        className="w-[90vw] max-w-sm rounded-xl border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/40"
      >
        {editing ? (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
            <input name="title" required defaultValue={event.title} placeholder="Event title" className={`${inputClass} sm:col-span-2`} />
            <select name="assigned_member_id" defaultValue={event.assigned_member_id ?? ""} className={inputClass}>
              <option value="">Whole family</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.member_name}
                </option>
              ))}
            </select>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Date</label>
              <input name="date" type="date" required defaultValue={dateStr} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Time (leave blank for all-day)</label>
              <input name="time" type="time" defaultValue={timeStr} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">End time (optional)</label>
              <input name="end_time" type="time" defaultValue={endTimeStr} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Type</label>
              <select name="event_type" defaultValue={event.event_type} className={inputClass}>
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
              <select name="recurrence" defaultValue={event.recurrence} className={inputClass}>
                <option value="none">Does not repeat</option>
                <option value="daily">Repeats daily</option>
                <option value="weekly">Repeats weekly</option>
                <option value="monthly">Repeats monthly</option>
                <option value="yearly">Repeats yearly (e.g. birthdays)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Repeat until (leave blank for forever)</label>
              <input name="recurrence_end" type="date" defaultValue={event.recurrence_end ?? ""} className={inputClass} />
            </div>
            <input name="location" defaultValue={event.location ?? ""} placeholder="Location (optional)" className={inputClass} />
            {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={loading} className={buttonClass}>
                {loading ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="text-sm text-slate-500 hover:text-slate-700">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5">
            {event.event_type !== "general" && (
              <p className="mb-1 text-xs font-medium uppercase text-slate-400">
                {icon ? `${icon} ` : ""}
                {event.event_type}
              </p>
            )}
            <h3 className="mb-2 text-lg font-semibold text-slate-900 break-words">
              {event.title}
              {event.age ? ` (turns ${event.age})` : ""}
            </h3>
            <p className="mb-1 text-sm text-slate-600">
              {format(
                wallClockDate(event.start_at),
                event.all_day ? "EEEE, MMMM d, yyyy" : "EEEE, MMMM d, yyyy 'at' h:mma"
              )}
              {!event.all_day && event.end_at ? ` – ${format(wallClockDate(event.end_at), "h:mma")}` : ""}
            </p>
            {event.assigned_to && <p className="mb-1 text-sm text-slate-600">👤 {event.assigned_to}</p>}
            {event.location && <p className="mb-1 text-sm text-slate-600 break-words">📍 {event.location}</p>}
            {event.recurrence !== "none" && (
              <p className="mb-1 text-sm text-slate-500">↻ Repeats {event.recurrence}</p>
            )}
            <div className="mt-4 flex flex-wrap justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
                >
                  Edit{event.recurrence !== "none" ? " series" : ""}
                </button>
                <form action={deleteEvent}>
                  <input type="hidden" name="id" value={event.id} />
                  <button
                    type="submit"
                    title={event.recurrence !== "none" ? "Removes this whole repeating series" : "Remove this event"}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                  >
                    Remove{event.recurrence !== "none" ? " series" : ""}
                  </button>
                </form>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
