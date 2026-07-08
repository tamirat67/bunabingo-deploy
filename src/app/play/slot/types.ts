// ─── Shared TypeScript types for Buna Hot 5 slot game ───────────────────────

export const SLOT_SYMBOLS = [
  'CHERRY', 'LEMON', 'ORANGE', 'PLUM',
  'WATERMELON', 'GRAPES', 'BELL', 'BAR', 'SEVEN',
] as const;

export type SlotSymbol = typeof SLOT_SYMBOLS[number];

export interface LineWin {
  payline: 'TOP' | 'MIDDLE' | 'BOTTOM' | 'DIAG_DOWN' | 'DIAG_UP';
  symbol: SlotSymbol;
  baseMultiplier: number;
  amount: number;
}

export interface SpinResult {
  spinId: string;
  reelResult: SlotSymbol[][];    // [row][col] — 3×3
  multiplierResult: number;      // 1 | 2 | 3 | 5 | 10 | 15
  lineWins: LineWin[];
  totalWin: number;
  finalPayout: number;
  newBalance: number;
  serverSeedHash: string;
  serverSeed: string;
}

export interface GambleResult {
  won: boolean;
  choice: 'red' | 'black';
  outcome: 'red' | 'black';
  newPayout: number;
  round: number;
  gambleComplete: boolean;
  newBalance: number;
}

export interface SlotConfig {
  minBet: number;
  maxBet: number;
  betStep: number;
  paytable: Record<SlotSymbol, number>;
  multiplierValues: number[];
  gambleMaxRounds: number;
}

export interface HistorySpin {
  id: string;
  betAmount: number;
  multiplierResult: number;
  lineWins: LineWin[];
  totalWin: number;
  finalPayout: number;
  gambleComplete: boolean;
  createdAt: string;
}

export type SpinPhase =
  | 'IDLE'
  | 'SPINNING'
  | 'REVEALING'
  | 'WIN'
  | 'GAMBLE'
  | 'COLLECTING';

export type WinTier = 'NONE' | 'WIN' | 'BIG_WIN' | 'MEGA_WIN';
