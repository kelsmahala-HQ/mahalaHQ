/** Rounds up to the next whole dollar (a purchase that's already a whole dollar still rounds up a full dollar). */
export function calculateRoundUp(amount: number, multiplier: number) {
  const cents = Math.round(amount * 100);
  const nextDollarCents = Math.ceil(cents / 100) * 100;
  const diffCents = nextDollarCents === cents ? 100 : nextDollarCents - cents;
  return Math.round(diffCents * multiplier) / 100;
}
