// ─── Buna Wallet Auth Service ─────────────────────────────────────────────
// Production backend: https://api.bunatechhub.net
// Telerivet Webhook:  https://api.bunatechhub.net/webhook/telerivet

const BASE_URL = 'http://192.168.1.7:3004';

interface OtpSendResponse {
  success: boolean;
  message: string;
  phone?: string;
  expiresInSeconds?: number;
}

interface OtpVerifyResponse {
  success: boolean;
  message: string;
  phone?: string;
  token?: string;
  isNewUser?: boolean;
}

// Normalize Ethiopian phone numbers for display / sending
export function normalizePhone(raw: string): string {
  let cleaned = raw.replace(/\s+/g, '').replace(/[-()]/g, '');

  if (cleaned.startsWith('+251')) return cleaned;
  if (cleaned.startsWith('251'))  return '+' + cleaned;
  if (cleaned.startsWith('09') || cleaned.startsWith('07')) {
    return '+251' + cleaned.slice(1);
  }
  if (/^[79]/.test(cleaned)) return '+251' + cleaned;

  return cleaned;
}

// ── Send OTP ────────────────────────────────────────────────────────────────
export async function sendOTP(phone: string): Promise<OtpSendResponse> {
  const normalized = normalizePhone(phone);

  const response = await fetch(`${BASE_URL}/api/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: normalized }),
  });

  const data: OtpSendResponse = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to send OTP');
  }

  return data;
}

// ── Verify OTP ──────────────────────────────────────────────────────────────
export async function verifyOTP(
  phone: string,
  code: string
): Promise<OtpVerifyResponse> {
  const normalized = normalizePhone(phone);

  const response = await fetch(`${BASE_URL}/api/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: normalized, code }),
  });

  const data: OtpVerifyResponse = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Verification failed');
  }

  return data;
}

// ── Telegram Native Auth ────────────────────────────────────────────────────
export interface TelegramPollResponse {
  success: boolean;
  status?: 'pending';
  token?: string;
  phone?: string;
  isNewUser?: boolean;
  message?: string;
}

export async function pollTelegramAuth(sessionId: string): Promise<TelegramPollResponse> {
  const response = await fetch(`${BASE_URL}/api/auth/telegram/poll/${sessionId}`);
  const data: TelegramPollResponse = await response.json();
  if (!response.ok && !data.success) {
    throw new Error(data.message || 'Telegram auth failed');
  }
  return data;
}

// ── Health Check ─────────────────────────────────────────────────────────────
export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/health`, { method: 'GET' });
    const data = await response.json();
    return data.success === true;
  } catch {
    return false;
  }
}
