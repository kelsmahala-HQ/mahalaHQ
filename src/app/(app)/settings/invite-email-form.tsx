"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { sendInviteEmail } from "./actions";

export default function InviteEmailForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const formData = new FormData();
    formData.set("email", email);
    const result = await sendInviteEmail(formData);

    setLoading(false);
    if ("error" in result) setStatus({ type: "error", message: result.error });
    else {
      setStatus({ type: "success", message: `Invite sent to ${email}!` });
      setEmail("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="family.member@email.com"
        className={`${inputClass} w-64`}
      />
      <button type="submit" disabled={loading} className={buttonClass}>
        {loading ? "Sending..." : "Send invite"}
      </button>
      {status && (
        <p className={`w-full text-sm ${status.type === "error" ? "text-red-600" : "text-teal-600"}`}>{status.message}</p>
      )}
    </form>
  );
}
