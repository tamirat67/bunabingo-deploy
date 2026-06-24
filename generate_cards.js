const fs = require('fs');
const path = require('path');

function shuffleSlice(arr, seed) {
  let s = seed;
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateCard(cardId) {
  const seed = cardId * 2654435761;
  const B = shuffleSlice([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], seed).slice(0, 5);
  const I = shuffleSlice([16,17,18,19,20,21,22,23,24,25,26,27,28,29,30], seed + 1).slice(0, 5);
  const N = shuffleSlice([31,32,33,34,35,36,37,38,39,40,41,42,43,44,45], seed + 2).slice(0, 4);
  const G = shuffleSlice([46,47,48,49,50,51,52,53,54,55,56,57,58,59,60], seed + 3).slice(0, 5);
  const O = shuffleSlice([61,62,63,64,65,66,67,68,69,70,71,72,73,74,75], seed + 4).slice(0, 5);

  const rows = [];
  for (let r = 0; r < 5; r++) {
    rows.push([
      B[r],
      I[r],
      r === 2 ? 0 : N[r < 2 ? r : r - 1],
      G[r],
      O[r],
    ]);
  }
  return rows;
}

let output = 'export const PREDEFINED_CARDS: Record<number, number[][]> = {\n';
for (let id = 1; id <= 500; id++) {
  const card = generateCard(id);
  const rowStrings = card.map(row => `[${row.join(', ')}]`).join(', ');
  output += `  ${id}: [${rowStrings}],\n`;
}
output += '};\n';

const outPath = path.join(__dirname, 'backend', 'src', 'lib', 'predefinedCards.ts');
fs.writeFileSync(outPath, output, 'utf8');
console.log(`✅ Written 500 cards to ${outPath}`);
