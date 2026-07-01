export function countMatches(picks: number[], drawn: number[]): number {
  const drawnSet = new Set(drawn);
  return picks.filter((p) => drawnSet.has(p)).length;
}

// Fixed Odds Payout Table (Multipliers)
const PAYOUT_TABLE: Record<number, Record<number, number>> = {
  1: { 1: 2.8 },
  2: { 1: 1, 2: 5 },
  3: { 2: 1.5, 3: 35 },
  4: { 2: 1, 3: 7, 4: 60 },
  5: { 3: 3, 4: 25, 5: 250 },
  6: { 3: 1, 4: 11, 5: 70, 6: 500 },
  7: { 0: 1, 3: 1, 4: 3, 5: 20, 6: 100, 7: 1000 },
  8: { 0: 1, 4: 3, 5: 12, 6: 40, 7: 200, 8: 2000 },
  9: { 0: 1, 4: 2, 5: 6, 6: 20, 7: 100, 8: 1000, 9: 5000 },
  10: { 0: 1, 5: 3, 6: 25, 7: 100, 8: 400, 9: 2000, 10: 10000 },
};

export function getMultiplier(picksCount: number, matches: number): number {
  return PAYOUT_TABLE[picksCount]?.[matches] ?? 0;
}

/** stake and result are both in integer cents to avoid float rounding errors with money. */
export function calculatePayoutCents(
  stakeCents: number,
  multiplier: number
): number {
  return Math.round(stakeCents * multiplier);
}
