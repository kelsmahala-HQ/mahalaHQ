"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

export default function GoogleImportForm({
  currentUrl,
  action,
}: {
  currentUrl: string | null;
  action: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(!currentUrl);

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
          ✅ Connected
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-slate-400 hover:text-teal-600"
        >
          Change link
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input
        name="google_calendar_url"
        type="url"
        defaultValue={currentUrl ?? ""}
        placeholder="Paste your Google Calendar's secret iCal address"
        className={`${inputClass} min-w-0 flex-1`}
      />
      <button type="submit" className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100">
        Save
      </button>
    </form>
  );
}
