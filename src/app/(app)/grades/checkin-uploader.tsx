"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { readGradesFile, saveGradeCheckin } from "./actions";

type Row = { class_name: string; grade: string };

export default function CheckinUploader({
  planId,
  studentName,
  isFirstCheckin,
}: {
  planId: string;
  studentName: string;
  isFirstCheckin: boolean;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [detectedStudent, setDetectedStudent] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setMessage(null);
    setReading(true);
    const fd = new FormData();
    fd.set("file", file);
    const result = await readGradesFile(fd);
    setReading(false);
    e.target.value = "";
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setRows(result.classes);
    setDetectedStudent(result.student);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const result = await saveGradeCheckin(new FormData(e.currentTarget));
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setMessage(result.message);
    setRows(null);
    setDetectedStudent(null);
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev?.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) ?? null);
  }

  return (
    <div>
      {message && <p className="mb-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">{message}</p>}

      {!rows ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {isFirstCheckin
              ? `Upload ${studentName}'s PowerSchool grades (PDF printout or screenshot) — this becomes the starting point`
              : `Upload ${studentName}'s latest PowerSchool grades (PDF printout or screenshot)`}
          </label>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={handleFile}
            disabled={reading}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-teal-700 hover:file:bg-teal-100"
          />
          {reading && <p className="mt-2 text-sm text-slate-500">Reading the grades…</p>}
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-3">
          <input type="hidden" name="plan_id" value={planId} />
          {detectedStudent && (
            <p className="text-xs text-slate-500">
              The file says this is for <span className="font-medium text-slate-700">{detectedStudent}</span> — make sure that&rsquo;s{" "}
              {studentName}.
            </p>
          )}
          <p className="text-xs text-slate-500">Check these against PowerSchool. Fix anything that&rsquo;s off before saving.</p>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input
                  name="class_name"
                  value={r.class_name}
                  onChange={(e) => updateRow(i, { class_name: e.target.value })}
                  className={`${inputClass} flex-1`}
                />
                <input
                  name="grade"
                  value={r.grade}
                  onChange={(e) => updateRow(i, { grade: e.target.value })}
                  className={`${inputClass} w-24`}
                />
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev?.filter((_, idx) => idx !== i) ?? null)}
                  className="px-2 text-slate-300 hover:text-red-500"
                  title="Remove this class"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium text-slate-500">Date</label>
            <input name="taken_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={`${inputClass} w-44`} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className={buttonClass}>
              {saving ? "Saving…" : isFirstCheckin ? "Save as starting point" : "Save & pay"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRows(null);
                setError(null);
              }}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && !rows && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
