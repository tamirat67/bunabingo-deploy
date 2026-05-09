/**
 * Bingo Card Generator
 * Generates unique 5x5 bingo cards using standard B-I-N-G-O column ranges:
 *   B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
 * Center (N[2]) is FREE space.
 */
export type BingoCard = (number | 'FREE')[][];
export declare function generateBingoCard(): BingoCard;
export declare function cardToFlat(card: BingoCard): (number | 'FREE')[];
export declare function getAllCardNumbers(card: BingoCard): number[];
/**
 * Check all bingo win patterns
 */
export type WinResult = {
    won: boolean;
    modes: ('ROW' | 'COLUMN' | 'DIAGONAL' | 'FOUR_CORNERS' | 'FULL_HOUSE')[];
};
export declare function checkWin(card: BingoCard, drawnNumbers: number[]): WinResult;
//# sourceMappingURL=card.generator.d.ts.map