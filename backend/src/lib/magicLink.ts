import crypto from 'crypto';

const SECRET = process.env.BOT_TOKEN || 'dev_secret';

/**
 * Generates a secure, time-limited magic login URL.
 * The URL can be opened in any browser and will auto-log the user in.
 *
 * @param telegramId - The user's Telegram ID (as string or bigint)
 * @param miniAppUrl - Base URL of the frontend (e.g. https://bunatechhub.net)
 * @param ttlSeconds - How long the link is valid for (default: 3600 = 1 hour)
 */
export function generateMagicLink(
  telegramId: bigint | string | number,
  miniAppUrl: string,
  ttlSeconds = 3600
): string {
  const ts = Math.floor(Date.now() / 1000);
  const tgId = telegramId.toString();
  const payload = `${tgId}:${ts}`;

  const sig = crypto
    .createHmac('sha256', SECRET)
    .update(payload)
    .digest('hex');

  const base = miniAppUrl.replace(/\/$/, '');
  return `${base}/autologin?tgId=${encodeURIComponent(tgId)}&ts=${ts}&sig=${sig}`;
}

/**
 * Verifies a magic link's signature and expiry.
 * Returns the telegramId string if valid, or null if invalid/expired.
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

    // Reject expired links
    if (now - tsNum > ttlSeconds) return null;
    // Reject future timestamps (clock skew > 60s)
    if (tsNum - now > 60) return null;

    const payload = `${tgId}:${ts}`;
    const expectedSig = crypto
      .createHmac('sha256', SECRET)
      .update(payload)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const sigBuf = Buffer.from(sig.padEnd(64, '0').slice(0, 64), 'hex');
    const expBuf = Buffer.from(expectedSig, 'hex');

    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    return tgId;
  } catch {
    return null;
  }
}
