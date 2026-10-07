"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { closeGradePlan, createGradePlan, setLatestMissingCount, updateGradePlanCap } from "./actions";

export function NewPlanForm({ members }: { members: { id: string; display_name: string }[] }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);
    const result = await createGradePlan(new FormData(form));
    setLoading(false);
    if ("error" in result) setError(result.error);
    else form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <select name="member_id" required className={inputClass} defaultValue="">
        <option value="" disabled>
          Who is this for?
        </option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.display_name}
          </option>
        ))}
      </select>
      <input name="label" required placeholder="Grading period (e.g. Q1 2026-27)" className={inputClass} />
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Most this plan can pay for the quarter ($)</label>
        <input name="cash_cap" type="number" min={0} defaultValue={100} className={inputClass} />
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <button type="submit" disabled={loading} className={`${buttonClass} sm:col-span-2`}>
        {loading ? "Starting…" : "Start plan"}
      </button>
    </form>
  );
}

export function ClosePlanButton({ planId }: { planId: string }) {
  const [state, setState] = useState<"idle" | "confirm" | "loading">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function close() {
    setState("loading");
    const fd = new FormData();
    fd.set("plan_id", planId);
    const result = await closeGradePlan(fd);
    if ("error" in result) {
      setError(result.error);
      setState("idle");
    } else {
      setMessage(result.message);
      setState("idle");
    }
  }

  if (message) return <p className="text-sm text-teal-700">{message}</p>;

  return (
    <div>
      {state === "idle" ? (
        <button type="button" onClick={() => setState("confirm")} className="text-xs font-medium text-slate-500 hover:text-slate-700">
          Close quarter &amp; pay bonuses
        </button>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-600">Pays the end-of-quarter bonuses and locks this plan. Sure?</span>
          <button
            type="button"
            disabled={state === "loading"}
            onClick={close}
            className="rounded-lg bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700"
          >
            {state === "loading" ? "Closing…" : "Yes, close it"}
          </button>
          <button type="button" onClick={() => setState("idle")} className="text-xs text-slate-500 hover:text-slate-700">
            Cancel
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function CapEditor({ planId, cap }: { planId: string; cap: number }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const result = await updateGradePlanCap(new FormData(e.currentTarget));
    if ("error" in result) setError(result.error);
    else setEditing(false);
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-slate-500 hover:text-slate-700">
        Change the ${cap} quarterly cap
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="plan_id" value={planId} />
      <span className="text-slate-600">Most this plan can pay: $</span>
      <input name="cash_cap" type="number" min={0} defaultValue={cap} className={`${inputClass} !w-24`} />
      <button type="submit" className="rounded-lg bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700">
        Save
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-slate-700">
        Cancel
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}

/** Where the current missing-assignments total lives between uploads: set it here to add or fix it without paying anything. */
export function MissingCountEditor({ planId, current }: { planId: string; current: number | null }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const result = await setLatestMissingCount(new FormData(e.currentTarget));
    if ("error" in result) setError(result.error);
    else setEditing(false);
  }

  if (!editing) {
    return (
      <p className="text-sm text-slate-600">
        Missing assignments:{" "}
        <span className="font-semibold text-slate-800">{current === null ? "not entered yet" : current}</span>{" "}
        <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-teal-600 hover:text-teal-500">
          {current === null ? "Enter the number now" : "Change"}
        </button>
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="plan_id" value={planId} />
      <span className="text-slate-600">Missing right now, all classes:</span>
      <input name="missing_count" type="number" min={0} defaultValue={current ?? undefined} required className={`${inputClass} !w-24`} />
      <button type="submit" className="rounded-lg bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700">
        Save
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-slate-700">
        Cancel
      </button>
      <span className="text-xs text-slate-400">Doesn&rsquo;t pay anything — it&rsquo;s the number next week&rsquo;s drop is measured from.</span>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}
