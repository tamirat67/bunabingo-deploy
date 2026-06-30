export function countMatches(picks: number[], drawn: number[]): number {
  const drawnSet = new Set(drawn);
  return picks.filter((p) => drawnSet.has(p)).length;
}

// Pari-Mutuel Share Table
// These numbers represent the "shares" a winning ticket gets of the prize pool.
// Higher shares = a bigger slice of the pot.
const DEFAULT_SHARE_TABLE: Record<number, Record<number, number>> = {
  1: { 1: 3 },
  2: { 2: 10 },
  3: { 2: 1, 3: 30 },
  4: { 2: 1, 3: 3, 4: 80 },
  5: { 3: 1, 4: 10, 5: 600 },
  6: { 3: 1, 4: 3, 5: 70, 6: 1200 },
  7: { 4: 1, 5: 15, 6: 300, 7: 4000 },
  8: { 5: 8, 6: 60, 7: 1200, 8: 8000 },
  9: { 5: 3, 6: 30, 7: 320, 8: 2000, 9: 15000 },
  10: { 5: 1, 6: 15, 7: 60, 8: 500, 9: 3000, 10: 40000 },
};

export function defaultShares(picksCount: number, matches: number): number {
  return DEFAULT_SHARE_TABLE[picksCount]?.[matches] ?? 0;
}

/** stake and result are both in integer cents to avoid float rounding errors with money. */
export function calculatePayoutCents(
  stakeCents: number,
  multiplier: number
): number {
  return Math.round(stakeCents * multiplier);
}
