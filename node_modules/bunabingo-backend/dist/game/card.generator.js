"use strict";
/**
 * Bingo Card Generator
 * Generates unique 5x5 bingo cards using standard B-I-N-G-O column ranges:
 *   B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
 * Center (N[2]) is FREE space.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBingoCard = generateBingoCard;
exports.cardToFlat = cardToFlat;
exports.getAllCardNumbers = getAllCardNumbers;
exports.checkWin = checkWin;
const COLUMN_RANGES = [
    { min: 1, max: 15 }, // B
    { min: 16, max: 30 }, // I
    { min: 31, max: 45 }, // N
    { min: 46, max: 60 }, // G
    { min: 61, max: 75 }, // O
];
function getRandomNumbers(min, max, count) {
    const pool = [];
    for (let i = min; i <= max; i++)
        pool.push(i);
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
}
function generateBingoCard() {
    const card = [];
    for (let col = 0; col < 5; col++) {
        const { min, max } = COLUMN_RANGES[col];
        const nums = getRandomNumbers(min, max, 5);
        card.push(nums);
    }
    // Transpose: card is currently col-major, convert to row-major
    const rowMajor = Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, col) => card[col][row]));
    // Center FREE space (row 2, col 2)
    rowMajor[2][2] = 'FREE';
    return rowMajor;
}
function cardToFlat(card) {
    return card.flat();
}
function getAllCardNumbers(card) {
    return card.flat().filter((n) => n !== 'FREE');
}
function checkWin(card, drawnNumbers) {
    const drawn = new Set(drawnNumbers);
    const modes = [];
    const isMarked = (r, c) => {
        const val = card[r][c];
        return val === 'FREE' || drawn.has(val);
    };
    // Check rows
    for (let r = 0; r < 5; r++) {
        if ([0, 1, 2, 3, 4].every(c => isMarked(r, c))) {
            modes.push('ROW');
            break;
        }
    }
    // Check columns
    for (let c = 0; c < 5; c++) {
        if ([0, 1, 2, 3, 4].every(r => isMarked(r, c))) {
            modes.push('COLUMN');
            break;
        }
    }
    // Check diagonals
    if ([0, 1, 2, 3, 4].every(i => isMarked(i, i)))
        modes.push('DIAGONAL');
    if ([0, 1, 2, 3, 4].every(i => isMarked(i, 4 - i))) {
        if (!modes.includes('DIAGONAL'))
            modes.push('DIAGONAL');
    }
    // Four corners
    if (isMarked(0, 0) && isMarked(0, 4) && isMarked(4, 0) && isMarked(4, 4)) {
        modes.push('FOUR_CORNERS');
    }
    // Full house
    const allMarked = [0, 1, 2, 3, 4].every(r => [0, 1, 2, 3, 4].every(c => isMarked(r, c)));
    if (allMarked)
        modes.push('FULL_HOUSE');
    return { won: modes.length > 0, modes };
}
//# sourceMappingURL=card.generator.js.map