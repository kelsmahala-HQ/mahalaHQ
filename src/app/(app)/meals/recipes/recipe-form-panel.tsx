"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { extractRecipe } from "./extract-actions";
import AddRecipeForm from "./add-recipe-form";
import type { ExtractedRecipe } from "@/lib/recipe-extract";

export default function RecipeFormPanel() {
  const [draft, setDraft] = useState<ExtractedRecipe | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [input, setInput] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  async function handleExtract() {
    if (!input.trim()) return;
    setExtracting(true);
    setExtractError(null);
    const result = await extractRecipe(input.trim());
    setExtracting(false);

    if ("error" in result) {
      setExtractError(result.error);
      return;
    }
    setDraft(result);
    setDraftKey((k) => k + 1);
    setAddOpen(true);
    setImportOpen(false);
    setInput("");
  }

  return (
    <div className="mb-8 space-y-3">
      <details
        open={importOpen}
        onToggle={(e) => setImportOpen(e.currentTarget.open)}
        className="group rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-sm font-semibold text-slate-700 sm:p-5 [&::-webkit-details-marker]:hidden">
          ✨ Import a recipe
          <span className="ml-2 text-slate-400 transition-transform group-open:rotate-90">▸</span>
        </summary>
        <div className="space-y-3 px-3 pb-3 sm:px-5 sm:pb-5">
          <p className="text-xs text-slate-500">
            Paste a recipe website link, or paste the recipe text itself — Claude will pull out the ingredients and
            steps for you to review below before it saves.
          </p>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://example.com/recipe  —  or paste the recipe text..."
            rows={3}
            className={inputClass}
          />
          {extractError && <p className="text-sm text-red-600">{extractError}</p>}
          <button type="button" onClick={handleExtract} disabled={extracting || !input.trim()} className={buttonClass}>
            {extracting ? "Reading recipe..." : "Extract recipe"}
          </button>
        </div>
      </details>

      <details
        open={addOpen}
        onToggle={(e) => setAddOpen(e.currentTarget.open)}
        className="group rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-sm font-semibold text-slate-700 sm:p-5 [&::-webkit-details-marker]:hidden">
          {draft ? "Review & save recipe" : "Add a recipe"}
          <span className="ml-2 text-slate-400 transition-transform group-open:rotate-90">▸</span>
        </summary>
        <div className="px-3 pb-3 sm:px-5 sm:pb-5">
          {draft && (
            <p className="mb-3 text-xs text-amber-600">
              Double-check the ingredients and amounts below — AI extraction can occasionally misread a quantity.
            </p>
          )}
          <AddRecipeForm
            key={draftKey}
            initial={draft}
            onSaved={() => {
              setDraft(null);
              setAddOpen(false);
            }}
          />
        </div>
      </details>
    </div>
  );
}
