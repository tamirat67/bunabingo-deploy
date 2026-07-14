import crypto from 'crypto';

function seededRandom(serverSeed: string, clientSeed: string, nonce: number): number {
  const hmac = crypto.createHmac('sha256', serverSeed);
  hmac.update(`${clientSeed}:${nonce}`);
  const hash = hmac.digest('hex');
  const val = parseInt(hash.slice(0, 8), 16);
  return val / 0xffffffff;
}

const serverSeed = crypto.randomBytes(32).toString('hex');
const clientSeed = crypto.randomBytes(4).toString('hex');

console.log("Random tests:");
for (let i = 1; i <= 10; i++) {
  console.log(`Nonce ${i}:`, seededRandom(serverSeed, clientSeed, i));
}
