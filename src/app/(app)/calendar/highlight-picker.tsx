"use client";

import { useState } from "react";
import { HIGHLIGHT_COLORS } from "./highlight-colors";

export default function HighlightPicker({ defaultValue }: { defaultValue?: string | null }) {
  const [value, setValue] = useState(defaultValue || "");

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">Highlight color (optional)</label>
      <div className="flex flex-wrap items-center gap-1.5">
        <input type="hidden" name="highlight_color" value={value} />
        <button
          type="button"
          title="No highlight"
          onClick={() => setValue("")}
          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white text-[10px] text-slate-400 ${
            value === "" ? "border-slate-700" : "border-slate-200"
          }`}
        >
          ✕
        </button>
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            title={c.label}
            onClick={() => setValue(c.value)}
            style={{ backgroundColor: c.value }}
            className={`h-6 w-6 rounded-full border-2 ${value === c.value ? "border-slate-700" : "border-white"}`}
          />
        ))}
      </div>
    </div>
  );
}
