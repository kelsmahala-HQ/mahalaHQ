// Chore points and grade points are two separate currencies: each buys only from its own rewards
// store. Both ride the chore_completions table (kind = 'grade' marks grade points) and both are
// spent through reward_redemptions (source says which store it came from), so this is the one
// place that turns those rows into a balance.

export type PointSource = "chores" | "grades";

type CompletionRow = { points: number; approval_status: string; kind: string };
type RedemptionRow = { cost: number; status: string; source?: string | null };

/** Approved points earned in this currency, minus what's reserved by pending/approved redemptions. */
export function balanceFor(source: PointSource, completions: CompletionRow[], redemptions: RedemptionRow[]): number {
  const earned = completions
    .filter((c) => c.approval_status === "approved" && (c.kind === "grade") === (source === "grades"))
    .reduce((sum, c) => sum + c.points, 0);
  const reserved = redemptions
    .filter((r) => (r.source ?? "chores") === source && (r.status === "pending" || r.status === "approved"))
    .reduce((sum, r) => sum + r.cost, 0);
  return earned - reserved;
}
