/**
 * Bingo Card Generator
 * Generates unique 5x5 bingo cards using standard B-I-N-G-O column ranges:
 *   B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
 * Center (N[2]) is FREE space.
 */

export type BingoCard = (number | 'FREE')[][];

const COLUMN_RANGES = [
  { min: 1,  max: 15  }, // B
  { min: 16, max: 30  }, // I
  { min: 31, max: 45  }, // N
  { min: 46, max: 60  }, // G
  { min: 61, max: 75  }, // O
];

function getRandomNumbers(min: number, max: number, count: number): number[] {
  const pool: number[] = [];
  for (let i = min; i <= max; i++) pool.push(i);
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function generateBingoCard(): BingoCard {
  const card: (number | 'FREE')[][] = [];

  for (let col = 0; col < 5; col++) {
    const { min, max } = COLUMN_RANGES[col];
    const nums = getRandomNumbers(min, max, 5);
    card.push(nums as (number | 'FREE')[]);
  }

  // Transpose: card is currently col-major, convert to row-major
  const rowMajor: (number | 'FREE')[][] = Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 5 }, (_, col) => card[col][row])
  );

  // Center FREE space (row 2, col 2)
  rowMajor[2][2] = 'FREE';

  return rowMajor;
}

export function cardToFlat(card: BingoCard): (number | 'FREE')[] {
  return card.flat();
}

export function getAllCardNumbers(card: BingoCard): number[] {
  return card.flat().filter((n): n is number => n !== 'FREE');
}

export function parseCardRows(cardField: any): BingoCard | null {
  if (!cardField) return null;
  let parsed = cardField;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {
      return null;
    }
  }
  // Try parsing inner level if it is double-serialized
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {
      return null;
    }
  }
  if (!parsed) return null;
  const rows = Array.isArray(parsed) ? parsed : (parsed.rows ?? null);
  if (Array.isArray(rows)) {
    return rows as BingoCard;
  }
  return null;
}

/**
 * Check all bingo win patterns
 */
export type WinResult = {
  won: boolean;
  modes: ('ROW' | 'COLUMN' | 'DIAGONAL' | 'FOUR_CORNERS' | 'FULL_HOUSE')[];
};

export function checkWin(card: BingoCard, drawnNumbers: number[]): WinResult {
  const drawn = new Set(drawnNumbers);
  const modes: WinResult['modes'] = [];

  const isMarked = (r: number, c: number): boolean => {
    const val = card[r][c];
    return val === 'FREE' || drawn.has(val as number);
  };

  // Shuffle row/column check order so wins don't always come from the same row
  const shuffled = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);

  // Check rows (in shuffled order)
  for (const r of shuffled) {
    if ([0,1,2,3,4].every(c => isMarked(r, c))) {
      modes.push('ROW');
      break;
    }
  }

  // Check columns (in shuffled order)
  const shuffledCols = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
  for (const c of shuffledCols) {
    if ([0,1,2,3,4].every(r => isMarked(r, c))) {
      modes.push('COLUMN');
      break;
    }
  }

  // Check diagonals
  if ([0,1,2,3,4].every(i => isMarked(i, i))) modes.push('DIAGONAL');
  if ([0,1,2,3,4].every(i => isMarked(i, 4 - i))) {
    if (!modes.includes('DIAGONAL')) modes.push('DIAGONAL');
  }

  // Four corners
  if (isMarked(0,0) && isMarked(0,4) && isMarked(4,0) && isMarked(4,4)) {
    modes.push('FOUR_CORNERS');
  }

  // Full house
  const allMarked = [0,1,2,3,4].every(r => [0,1,2,3,4].every(c => isMarked(r, c)));
  if (allMarked) modes.push('FULL_HOUSE');

  return { won: modes.length > 0, modes };
}
