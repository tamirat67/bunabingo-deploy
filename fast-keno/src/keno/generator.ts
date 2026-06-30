import { randomBytes, createHash } from "crypto";

const POOL_SIZE = 80;
const DRAW_COUNT = 20;

export function generateServerSeed(): string {
  return randomBytes(32).toString("hex");
}

export function hashSeed(serverSeed: string): string {
  return sha256(serverSeed);
}

/**
 * Deterministic draw: same (serverSeed, clientSeed, nonce) always produces
 * the same 20 numbers. Server seed hash is published BEFORE betting closes;
 * the raw seed is revealed only after the draw, so players can recompute
 * this function themselves and confirm the draw wasn't tampered with.
 *
 * Uses a seeded mulberry32 PRNG fed by the SHA-256 of the combined inputs —
 * deterministic and NOT Node's Math.random (which is not reproducible/auditable).
 */
export function drawNumbers(serverSeed: string, clientSeed: string, nonce: number): number[] {
  const combined = `${serverSeed}:${clientSeed}:${nonce}`;
  const seedInt = hashToUint32(combined);
  const rng = mulberry32(seedInt);

  const pool = Array.from({ length: POOL_SIZE }, (_, i) => i + 1);
  // Fisher-Yates shuffle using the seeded RNG
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, DRAW_COUNT);
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function hashToUint32(input: string): number {
  const hash = sha256(input);
  return parseInt(hash.substring(0, 8), 16);
}

// mulberry32: small, fast, deterministic PRNG seeded by a 32-bit int
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
