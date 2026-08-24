"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { addProfile } from "./actions";

export default function AddProfileForm({ members }: { members: { id: string; display_name: string }[] }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setLoading(true);

    const result = await addProfile(new FormData(form));

    setLoading(false);
    if ("error" in result) setError(result.error);
    else form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input name="member_name" required placeholder="Name" className={inputClass} />
      <input name="date_of_birth" type="date" className={inputClass} />
      <select name="member_id" defaultValue="" className={`${inputClass} sm:col-span-2`}>
        <option value="">Not linked to a login (e.g. a baby, or add details before they sign up)</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            Link to {m.display_name}&rsquo;s login
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <button type="submit" disabled={loading} className={`${buttonClass} sm:col-span-2`}>
        {loading ? "Adding..." : "Add family member"}
      </button>
    </form>
  );
}
