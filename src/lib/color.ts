// Soft, pastel-leaning palette (teal to echo the app's own brand accent, plus five more
// muted tones) -- paired with dark text wherever it's used, not white, since these are
// too light for white text to stay readable on.
const COLORS = ["#5eead4", "#fda4af", "#a5b4fc", "#fcd34d", "#7dd3fc", "#6ee7b7"];

export function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}
