// Predefined Bingo Cards 1-100
// Making generation deterministic to prevent hydration mismatches
export const PREDEFINED_CARDS: Record<number, number[][]> = {
  1: [[1, 16, 31, 46, 61], [2, 17, 32, 47, 62], [3, 18, 0, 48, 63], [4, 19, 34, 49, 64], [5, 20, 35, 50, 65]],
  2: [[10, 25, 40, 55, 70], [11, 26, 41, 56, 71], [12, 27, 0, 57, 72], [13, 28, 43, 58, 73], [14, 29, 44, 59, 74]],
};

// Simple deterministic pseudo-random generator
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Fill up to 100 deterministically
for (let i = 3; i <= 100; i++) {
  const card: number[][] = [];
  for (let c = 0; c < 5; c++) {
    const col: number[] = [];
    const min = c * 15 + 1;
    const max = (c + 1) * 15;
    
    // Pick 5 unique numbers for the column deterministically
    const pool = Array.from({ length: 15 }, (_, j) => min + j);
    for (let r = 0; r < 5; r++) {
      if (c === 2 && r === 2) {
        col.push(0); // Free space
      } else {
        const randomIndex = Math.floor(seededRandom(i * 100 + c * 10 + r) * pool.length);
        col.push(pool.splice(randomIndex, 1)[0]);
      }
    }
    card.push(col);
  }
  
  // Transpose because we built columns but need rows for the UI
  const rows: number[][] = [[], [], [], [], []];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      rows[r][c] = card[c][r];
    }
  }
  PREDEFINED_CARDS[i] = rows;
}
