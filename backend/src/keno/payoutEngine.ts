export function countMatches(picks: number[], drawn: number[]): number {
  const drawnSet = new Set(drawn);
  return picks.filter((p) => drawnSet.has(p)).length;
}

// Fixed Odds Payout Table (Multipliers)
const PAYOUT_TABLE: Record<number, Record<number, number>> = {
  1: { 1: 3.5 },
  2: { 1: 1, 2: 10 },
  3: { 2: 2, 3: 50 },
  4: { 2: 1.5, 3: 10, 4: 80 },
  5: { 2: 1, 3: 3, 4: 30, 5: 150 },
  6: { 3: 2, 4: 15, 5: 60, 6: 500 },
  7: { 0: 1, 3: 2, 4: 4, 5: 20, 6: 80, 7: 1000 },
  8: { 0: 1, 4: 5, 5: 15, 6: 50, 7: 200, 8: 2000 },
  9: { 0: 2, 4: 2, 5: 10, 6: 25, 7: 125, 8: 1000, 9: 5000 },
  10: { 0: 2, 5: 5, 6: 30, 7: 100, 8: 300, 9: 2000, 10: 10000 },
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
