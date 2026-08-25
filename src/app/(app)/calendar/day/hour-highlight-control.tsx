"use client";

import { useState } from "react";
import { HIGHLIGHT_COLORS } from "../highlight-colors";
import { addHighlight } from "./highlight-actions";

export default function HourHighlightControl({
  date,
  hour,
  label,
}: {
  date: string;
  hour: number;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState<string>(HIGHLIGHT_COLORS[0].value);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);

    const result = await addHighlight(new FormData(form));

    setLoading(false);
    if ("error" in result) setError(result.error);
    else setOpen(false);
  }

  return (
    <div className="relative w-16 shrink-0 border-r border-slate-100">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Click to highlight this time"
        className="w-full px-2 py-1.5 text-right text-xs text-slate-400 hover:bg-slate-50 hover:text-teal-600"
      >
        {label}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-10 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-2">
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="start_hour" value={hour} />
            <input type="hidden" name="color" value={color} />

            <div className="flex flex-wrap gap-1.5">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setColor(c.value)}
                  style={{ backgroundColor: c.value }}
                  className={`h-6 w-6 rounded-full border-2 ${color === c.value ? "border-slate-700" : "border-white"}`}
                />
              ))}
            </div>

            <input
              name="label"
              placeholder="Label (optional) — e.g. Babysitter"
              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none"
            />

            <div>
              <label className="mb-1 block text-[10px] font-medium text-slate-500">Span (hours)</label>
              <input
                name="span_hours"
                type="number"
                min={1}
                max={12}
                defaultValue={1}
                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
              />
            </div>

            {error && <p className="text-[10px] text-red-600">{error}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-teal-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Highlight"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-700">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
