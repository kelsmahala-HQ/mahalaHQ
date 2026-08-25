"use server";

import { requireHousehold } from "@/lib/household";
import { extractRecipeFromInput, type ExtractedRecipe } from "@/lib/recipe-extract";

export async function extractRecipe(input: string): Promise<ExtractedRecipe | { error: string }> {
  await requireHousehold();
  if (!input || input.trim().length < 3) return { error: "Paste a recipe link or some recipe text first." };
  return extractRecipeFromInput(input);
}
