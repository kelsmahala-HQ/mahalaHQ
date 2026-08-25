export type ExtractedRecipe = {
  name: string;
  servings: number | null;
  instructions: string | null;
  ingredients: { name: string; quantity: string | null }[];
};

const MAX_INPUT_CHARS = 12000;

function looksLikeUrl(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s.trim());
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveSourceText(input: string): Promise<{ text: string } | { error: string }> {
  const trimmed = input.trim();
  if (!looksLikeUrl(trimmed)) return { text: trimmed.slice(0, MAX_INPUT_CHARS) };

  try {
    const res = await fetch(trimmed, { headers: { "User-Agent": "Mozilla/5.0 (compatible; MahalaHQ-RecipeImport/1.0)" } });
    if (!res.ok) return { error: `Couldn't load that page (error ${res.status}).` };
    const html = await res.text();
    const text = stripHtml(html).slice(0, MAX_INPUT_CHARS);
    if (!text) return { error: "That page didn't have any readable text on it." };
    return { text };
  } catch {
    return { error: "Couldn't reach that URL — check the link and try again." };
  }
}

function normalizeIngredients(value: unknown): { name: string; quantity: string | null }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw): { name: string; quantity: string | null } => {
      if (!raw || typeof raw !== "object") return { name: "", quantity: null };
      const obj = raw as Record<string, unknown>;
      const name = typeof obj.name === "string" ? obj.name.trim() : "";
      const quantity = typeof obj.quantity === "string" && obj.quantity.trim() ? obj.quantity.trim() : null;
      return { name, quantity };
    })
    .filter((i) => i.name);
}

/** Sends recipe text (or a fetched page's text) to Claude and asks for it back as structured JSON. */
export async function extractRecipeFromInput(input: string): Promise<ExtractedRecipe | { error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "Recipe import isn't set up yet — an admin needs to add an Anthropic API key first." };

  const source = await resolveSourceText(input);
  if ("error" in source) return source;

  const prompt = `Extract the recipe from the text below into strict JSON matching exactly this shape, with no markdown fences and no commentary before or after it:
{"name": string, "servings": number|null, "instructions": string|null, "ingredients": [{"name": string, "quantity": string|null}]}

Rules:
- "quantity" is the amount and unit only (e.g. "2 cups", "1 tbsp"), never the ingredient name itself.
- "instructions" is the step-by-step directions as one string, steps separated by newlines, or null if none are present in the text.
- If the text below isn't actually a recipe, return {"name": "", "servings": null, "instructions": null, "ingredients": []}.

TEXT:
${source.text}`;

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    return { error: "Couldn't reach the recipe-reading service. Try again in a moment." };
  }

  if (!res.ok) {
    return { error: `Recipe extraction failed (error ${res.status}). Try again in a moment.` };
  }

  const data = await res.json();
  const raw = (data?.content?.[0]?.text as string | undefined)?.trim() ?? "";
  const jsonText = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { error: "Couldn't make sense of that recipe. Try pasting the recipe text directly instead of a link." };
  }

  const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
  if (!name) return { error: "Couldn't find a recipe in that — try pasting more of the page's text." };

  return {
    name,
    servings: typeof parsed.servings === "number" && parsed.servings > 0 ? parsed.servings : null,
    instructions: typeof parsed.instructions === "string" && parsed.instructions.trim() ? parsed.instructions.trim() : null,
    ingredients: normalizeIngredients(parsed.ingredients),
  };
}
