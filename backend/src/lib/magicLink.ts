import crypto from 'crypto';

const SECRET = process.env.BOT_TOKEN || 'dev_secret';

// ── Short-token store (in-process, 24-hour TTL) ───────────────────────────────
// Maps a short 12-char token → { tgId, sig, ts } so the browser URL stays clean.
interface PlayToken {
  tgId: string;
  ts:   string;
  sig:  string;
  expiresAt: number; // unix seconds
}

const playTokenStore = new Map<string, PlayToken>();

// Cleanup expired tokens every 10 minutes
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [key, val] of playTokenStore) {
    if (val.expiresAt < now) playTokenStore.delete(key);
  }
}, 10 * 60 * 1000);

/** Generate a 12-character alphanumeric short token */
function makeShortToken(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12);
}

/**
 * Creates a clean, short play URL.
 * Stores the HMAC-signed data server-side; the browser only sees a short code.
 *
 * Result looks like:  https://bunatechhub.net/play?k=ABC12345XYZ9
 */
export function generatePlayLink(
  telegramId: bigint | string | number,
  miniAppUrl: string,
  ttlSeconds = 86400 // 24 hours
): string {
  const ts    = Math.floor(Date.now() / 1000).toString();
  const tgId  = telegramId.toString();
  const payload = `${tgId}:${ts}`;

  const sig = crypto
    .createHmac('sha256', SECRET)
    .update(payload)
    .digest('hex');

  // Keep trying until we get a unique short token (collision is practically impossible)
  let shortToken = makeShortToken();
  while (playTokenStore.has(shortToken)) {
    shortToken = makeShortToken();
  }

  playTokenStore.set(shortToken, {
    tgId,
    ts,
    sig,
    expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds,
  });

  const base = miniAppUrl.replace(/\/$/, '');
  return `${base}/play?k=${shortToken}`;
}

/**
 * Resolves a short play token back to a telegramId.
 * Returns the telegramId if valid and not expired, or null.
 */
export function resolvePlayToken(shortToken: string): string | null {
  const entry = playTokenStore.get(shortToken);
  if (!entry) return null;

  const now = Math.floor(Date.now() / 1000);
  if (entry.expiresAt < now) {
    playTokenStore.delete(shortToken);
    return null;
  }

  // Verify the HMAC signature
  const payload     = `${entry.tgId}:${entry.ts}`;
  const expectedSig = crypto
    .createHmac('sha256', SECRET)
    .update(payload)
    .digest('hex');

  try {
    const sigBuf = Buffer.from(entry.sig.padEnd(64, '0').slice(0, 64), 'hex');
    const expBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  } catch {
    return null;
  }

  // One-time use: delete after resolving so the token can't be reused
  playTokenStore.delete(shortToken);

  return entry.tgId;
}

// ── Keep existing functions for backwards compat ─────────────────────────────

/**
 * Generates a long magic URL (kept for compatibility).
 */
export function generateMagicLink(
  telegramId: bigint | string | number,
  miniAppUrl: string,
  ttlSeconds = 3600
): string {
  const ts    = Math.floor(Date.now() / 1000);
  const tgId  = telegramId.toString();
  const payload = `${tgId}:${ts}`;

  const sig = crypto
    .createHmac('sha256', SECRET)
    .update(payload)
    .digest('hex');

  const base = miniAppUrl.replace(/\/$/, '');
  return `${base}/autologin?tgId=${encodeURIComponent(tgId)}&ts=${ts}&sig=${sig}`;
}

/**
 * Verifies a long magic link's signature and expiry.
 */
export function verifyMagicLink(
  tgId: string,
  ts: string,
  sig: string,
  ttlSeconds = 3600
): string | null {
  try {
    const now = Math.floor(Date.now() / 1000);
    const tsNum = parseInt(ts, 10);

    if (now - tsNum > ttlSeconds) return null;
    if (tsNum - now > 60) return null;

    const payload     = `${tgId}:${ts}`;
    const expectedSig = crypto
      .createHmac('sha256', SECRET)
      .update(payload)
      .digest('hex');

    const sigBuf = Buffer.from(sig.padEnd(64, '0').slice(0, 64), 'hex');
    const expBuf = Buffer.from(expectedSig, 'hex');

    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    return tgId;
  } catch {
    return null;
  }
}
