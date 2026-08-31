import { GROCERY_CATEGORY_VALUES } from "./grocery-categories";

export type ConsolidatedGroceryItem = { name: string; quantity: string; category: string };

/**
 * Sends this week's pulled recipe ingredients to Claude to merge real duplicates/near-
 * duplicates that exact-string matching can't reliably catch -- "onion", "yellow onion", and
 * "onions" from three different recipes should land as one line, not three. Also converts each
 * to a simple buy-count instead of a recipe measurement, and guesses a store category.
 * Returns null on any failure (missing key, bad response, etc.) so the caller can fall back to
 * the plain exact-match merge instead of blocking the whole pull.
 */
export async function consolidateGroceryIngredients(
  items: { name: string; quantity: string | null }[]
): Promise<ConsolidatedGroceryItem[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !items.length) return null;

  const list = items.map((i) => `- ${i.name}${i.quantity ? ` (${i.quantity})` : ""}`).join("\n");

  const prompt = `You're consolidating a household grocery shopping list pulled from several recipes. Merge any ingredients that are really the same thing to buy at the store -- different wording, capitalization, prep description ("diced", "chopped"), or minor variety (e.g. "yellow onion" and "onion") should be treated as one line. Keep genuinely different foods separate.

For quantity, ignore the recipe's measurement (cups, tbsp, lbs, oz) entirely -- give a simple count of how many to buy instead (e.g. "1/2 cup salsa" -> "1", "2 onions" -> "2", no amount given -> "1"), summing across every recipe that needed it.

Also pick the best-fitting store category for each item from exactly this list: ${GROCERY_CATEGORY_VALUES.join(", ")}.

Return strict JSON matching exactly this shape, with no markdown fences and no commentary before or after it:
{"items": [{"name": string, "quantity": string, "category": string}]}

INGREDIENTS:
${list}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const raw = (data?.content?.[0]?.text as string | undefined)?.trim() ?? "";
    const jsonText = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed.items)) return null;

    const knownCategories = new Set<string>(GROCERY_CATEGORY_VALUES);
    const result = parsed.items
      .map((item: unknown): ConsolidatedGroceryItem | null => {
        if (!item || typeof item !== "object") return null;
        const obj = item as Record<string, unknown>;
        const name = typeof obj.name === "string" ? obj.name.trim() : "";
        if (!name) return null;
        const quantity = typeof obj.quantity === "string" && obj.quantity.trim() ? obj.quantity.trim() : "1";
        const category = typeof obj.category === "string" && knownCategories.has(obj.category) ? obj.category : "other";
        return { name, quantity, category };
      })
      .filter((i: ConsolidatedGroceryItem | null): i is ConsolidatedGroceryItem => i !== null);

    return result.length ? result : null;
  } catch {
    return null;
  }
}
