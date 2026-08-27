"use client";

import { useState } from "react";
import { Card, buttonClass, iconButtonClass, inputClass } from "@/components/ui";
import { deleteSection, updateSection } from "./actions";

type Section = { id: string; title: string; body: string };

export default function SectionCard({ section }: { section: Section }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);

    const result = await updateSection(new FormData(form));

    setLoading(false);
    if ("error" in result) setError(result.error);
    else setEditing(false);
  }

  if (editing) {
    return (
      <Card>
        <form onSubmit={handleSubmit} className="space-y-2">
          <input type="hidden" name="id" value={section.id} />
          <input name="title" required defaultValue={section.title} placeholder="Section title" className={inputClass} />
          <textarea name="body" defaultValue={section.body} rows={6} className={inputClass} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className={buttonClass}>
              {loading ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-slate-500 hover:text-slate-700">
              Cancel
            </button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="font-semibold text-slate-900">{section.title}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-teal-600 hover:text-teal-500">
            Edit
          </button>
          <form action={deleteSection}>
            <input type="hidden" name="id" value={section.id} />
            <button className={iconButtonClass}>Remove</button>
          </form>
        </div>
      </div>
      <p className="whitespace-pre-wrap text-sm text-slate-600">{section.body}</p>
    </Card>
  );
}
