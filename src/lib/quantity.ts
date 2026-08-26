const NICE_FRACTIONS: [number, string][] = [
  [0.125, "⅛"],
  [0.25, "¼"],
  [1 / 3, "⅓"],
  [0.5, "½"],
  [2 / 3, "⅔"],
  [0.75, "¾"],
  [0.875, "⅞"],
];

function parseAmountToken(token: string): number | null {
  const mixed = token.match(/^(\d+)\s+(\d+)\/(\d+)$/); // "1 1/2"
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = token.match(/^(\d+)\/(\d+)$/); // "1/2"
  if (frac) return Number(frac[1]) / Number(frac[2]);
  if (/^\d+(\.\d+)?$/.test(token)) return Number(token);
  return null;
}

/** Parses a leading amount off a free-text quantity like "1 1/2 cups" or "2 cups" or "1 onion". */
export function parseQuantity(q: string): { amount: number; unit: string } | null {
  const trimmed = q.trim();
  const m = trimmed.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return null;
  const amount = parseAmountToken(m[1]);
  if (amount === null) return null;
  return { amount, unit: m[2].trim() };
}

/** Formats a scaled amount the way a recipe would -- nice fractions for common cooking
 *  measures (½, ⅓, ¾, ...), otherwise a plain rounded number. */
function formatAmount(n: number): string {
  const whole = Math.floor(n);
  const frac = n - whole;

  if (frac < 0.02) return String(Math.round(n));

  for (const [value, symbol] of NICE_FRACTIONS) {
    if (Math.abs(frac - value) < 0.03) return whole > 0 ? `${whole}${symbol}` : symbol;
  }

  return String(Math.round(n * 100) / 100);
}

/** Scales a free-text quantity by a factor (e.g. "2 cups" x 1.5 -> "3 cups"). Returns the
 *  original text unchanged if it doesn't start with a recognizable amount (e.g. "to taste"). */
export function scaleQuantity(quantity: string, factor: number): string {
  const parsed = parseQuantity(quantity);
  if (!parsed) return quantity;
  const scaled = formatAmount(parsed.amount * factor);
  return parsed.unit ? `${scaled} ${parsed.unit}` : scaled;
}
