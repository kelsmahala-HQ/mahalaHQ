"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createHousehold, joinHousehold } from "./actions";

export default function OnboardingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.set("displayName", displayName);

    let result;
    if (mode === "create") {
      formData.set("name", name);
      result = await createHousehold(formData);
    } else {
      formData.set("inviteCode", inviteCode);
      result = await joinHousehold(formData);
    }

    setLoading(false);

    if ("error" in result) return setError(result.error);

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-slate-900">Set up your household</h1>
        <p className="mb-6 text-sm text-slate-500">
          {mode === "create"
            ? "Create a new household for your family."
            : "Join an existing household with an invite code."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Your name</label>
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              placeholder="Kelsey"
            />
          </div>

          {mode === "create" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Household name
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                placeholder="The Smith Family"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Invite code
              </label>
              <input
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                placeholder="e.g. a1b2c3d4"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
          >
            {loading ? "Please wait..." : mode === "create" ? "Create household" : "Join household"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "create" ? "join" : "create")}
          className="mt-4 w-full text-center text-sm text-slate-500 hover:text-teal-600"
        >
          {mode === "create" ? "Have an invite code? Join instead" : "Start a new household instead"}
        </button>
      </div>
    </div>
  );
}
