"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { closeGradePlan, createGradePlan } from "./actions";

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
        <label className="mb-1 block text-xs font-medium text-slate-500">Most cash this plan can earn ($)</label>
        <input name="cash_cap" type="number" min={0} defaultValue={40} className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Points per $1</label>
        <input name="points_per_dollar" type="number" min={1} defaultValue={10} className={inputClass} />
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
