"use client";

import { useRef } from "react";
import { format } from "date-fns";

type Props = {
  event: {
    id: string;
    occurrenceKey: string;
    title: string;
    location: string | null;
    start_at: string;
    all_day: boolean;
    color: string;
    recurrence: string;
    event_type: string;
    age: number | null;
  };
  icon: string;
  deleteEvent: (formData: FormData) => void;
};

export default function EventPill({ event, icon, deleteEvent }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

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
        {event.all_day ? "" : format(new Date(event.start_at), "h:mma ")}
        {event.title}
        {event.age ? ` (turns ${event.age})` : ""}
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="w-[90vw] max-w-sm rounded-xl border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/40"
      >
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
              new Date(event.start_at),
              event.all_day ? "EEEE, MMMM d, yyyy" : "EEEE, MMMM d, yyyy 'at' h:mma"
            )}
          </p>
          {event.location && <p className="mb-1 text-sm text-slate-600 break-words">📍 {event.location}</p>}
          {event.recurrence !== "none" && (
            <p className="mb-1 text-sm text-slate-500">↻ Repeats {event.recurrence}</p>
          )}
          <div className="mt-4 flex justify-between gap-2">
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
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
