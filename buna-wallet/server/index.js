require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Telerivet sends form-encoded data

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ─── Rate Limiting ───────────────────────────────────────────────────────────
const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: { success: false, message: 'Too many OTP requests. Please wait 10 minutes.' },
  keyGenerator: (req) => req.body?.phone || req.ip,
});

const otpVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.body?.phone || req.ip,
});

// ─── In-Memory OTP Store ─────────────────────────────────────────────────────
// ⚠️ For production: replace with Redis
// Map<normalizedPhone, { code, expiresAt, attempts, messageId? }>
const otpStore = new Map();

const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || '6');
const OTP_EXPIRY_MS = parseInt(process.env.OTP_EXPIRY_SECONDS || '300') * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateOTP() {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < OTP_LENGTH; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
}

function normalizePhone(phone) {
  let cleaned = phone.replace(/\s+/g, '').replace(/[-()]/g, '');
  if (cleaned.startsWith('+251')) return cleaned;
  if (cleaned.startsWith('251'))  return '+' + cleaned;
  if (cleaned.startsWith('09') || cleaned.startsWith('07')) return '+251' + cleaned.slice(1);
  if (/^[79]/.test(cleaned)) return '+251' + cleaned;
  return cleaned;
}

async function sendSMSViaTelerivet(phone, message) {
  const apiKey     = process.env.TELERIVET_API_KEY;
  const projectId  = process.env.TELERIVET_PROJECT_ID;
  const phoneId    = process.env.TELERIVET_PHONE_ID;

  if (!apiKey || !projectId || !phoneId) {
    throw new Error('Telerivet credentials not configured. Check your .env file.');
  }

  const url = `https://api.telerivet.com/v1/projects/${projectId}/messages/send`;
  const credentials = Buffer.from(`${apiKey}:`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to_number: phone,
      content: message,
      route_id: phoneId,
      message_type: 'sms',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('[Telerivet] Error:', data);
    throw new Error(data.message || `SMS send failed (${response.status})`);
  }
  return data;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    service: 'Buna Wallet OTP Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    telerivet: {
      projectId: process.env.TELERIVET_PROJECT_ID || '(not set)',
      phoneId:   process.env.TELERIVET_PHONE_ID   || '(not set)',
      webhook:   'https://bunatechhub.net/webhook/telerivet',
    },
  });
});

// ── POST /api/otp/send ───────────────────────────────────────────────────────
app.post('/api/otp/send', otpSendLimiter, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const normalizedPhone = normalizePhone(phone);

    // Validate Ethiopian number: +251 followed by 9 or 7 and 8 more digits
    const ethiopianPhoneRegex = /^\+251[79]\d{8}$/;
    if (!ethiopianPhoneRegex.test(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid Ethiopian mobile number (e.g. 09XXXXXXXX).',
      });
    }

    const code = generateOTP();
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    // Store OTP (overwrite any previous pending code)
    otpStore.set(normalizedPhone, { code, expiresAt, attempts: 0, messageId: null });

    // SMS content
    const smsText =
      `☕ Buna Wallet\n` +
      `Your verification code is:\n\n` +
      `  ${code}\n\n` +
      `Expires in 5 minutes.\n` +
      `Do NOT share this code with anyone.`;

    const smsResult = await sendSMSViaTelerivet(normalizedPhone, smsText);

    // Store Telerivet message ID for status tracking
    if (smsResult.id) {
      otpStore.get(normalizedPhone).messageId = smsResult.id;
    }

    console.log(`[OTP] ✅ Sent to ${normalizedPhone} | Code: ${code} | Expires: ${new Date(expiresAt).toISOString()}`);

    res.json({
      success: true,
      message: `Verification code sent to ${normalizedPhone.slice(0, 7)}****`,
      phone: normalizedPhone,
      expiresInSeconds: OTP_EXPIRY_MS / 1000,
      messageId: smsResult.id,
    });
  } catch (error) {
    console.error('[OTP Send Error]', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send OTP. Please try again.',
    });
  }
});

// ── POST /api/otp/verify ─────────────────────────────────────────────────────
app.post('/api/otp/verify', otpVerifyLimiter, async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone and code are required.' });
    }

    const normalizedPhone = normalizePhone(phone);
    const stored = otpStore.get(normalizedPhone);

    if (!stored) {
      return res.status(400).json({
        success: false,
        message: 'No pending code for this number. Please request a new one.',
      });
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(normalizedPhone);
      return res.status(400).json({
        success: false,
        message: 'Code has expired. Please request a new one.',
      });
    }

    if (stored.attempts >= MAX_VERIFY_ATTEMPTS) {
      otpStore.delete(normalizedPhone);
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please request a new code.',
      });
    }

    if (stored.code !== code.trim()) {
      stored.attempts += 1;
      const remaining = MAX_VERIFY_ATTEMPTS - stored.attempts;
      return res.status(400).json({
        success: false,
        message: `Incorrect code — ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
        attemptsRemaining: remaining,
      });
    }

    // ✅ Success
    otpStore.delete(normalizedPhone);
    console.log(`[OTP] ✅ Verified: ${normalizedPhone}`);

    // TODO: replace sessionToken with a proper JWT
    const sessionToken = Buffer.from(`${normalizedPhone}:${Date.now()}`).toString('base64');

    res.json({
      success: true,
      message: 'Phone verified successfully.',
      phone: normalizedPhone,
      token: sessionToken,
      isNewUser: false,
    });
  } catch (error) {
    console.error('[OTP Verify Error]', error.message);
    res.status(500).json({ success: false, message: 'Verification failed. Please try again.' });
  }
});

// ── POST /webhook/telerivet ──────────────────────────────────────────────────
// Configured in Telerivet → Developer API → Webhook URL:
//   https://bunatechhub.net/webhook/telerivet
//
// Telerivet calls this endpoint for:
//   - Message status updates (delivered, failed)
//   - Incoming replies from users
app.post('/webhook/telerivet', (req, res) => {
  try {
    const data = req.body;
    
    // Verify Webhook Secret
    const expectedSecret = process.env.TELERIVET_WEBHOOK_SECRET;
    if (expectedSecret && data.secret !== expectedSecret) {
      console.warn('[Webhook Error] Invalid secret provided.');
      return res.status(403).json({ success: false, message: 'Invalid secret' });
    }

    const event   = data.event   || data.type || 'unknown';
    const msgId   = data.id      || '';
    const from    = data.from_number || '';
    const content = data.content || '';
    const status  = data.status  || '';
    const dir     = data.direction || '';

    console.log(`[Telerivet Webhook] event=${event} | from=${from} | status=${status} | dir=${dir} | content="${content}"`);

    // Handle delivery receipts
    if (event === 'send_status' || dir === 'outgoing') {
      console.log(`[Telerivet] Message ${msgId} status: ${status}`);

      if (status === 'failed' || status === 'not_sent') {
        console.warn(`[Telerivet] ⚠️ SMS delivery FAILED for message ${msgId}`);
        // TODO: notify app client via WebSocket / push notification
      }
    }

    // Handle incoming replies (e.g. user accidentally replies to OTP SMS)
    if (dir === 'incoming' || event === 'incoming_message') {
      console.log(`[Telerivet] Incoming from ${from}: "${content}"`);
      // Optionally auto-verify if they reply with a valid OTP code
      const normalized = normalizePhone(from);
      const stored = otpStore.get(normalized);
      const otpCode = content.replace(/\D/g, '').trim();

      if (stored && otpCode.length === OTP_LENGTH && stored.code === otpCode) {
        otpStore.delete(normalized);
        console.log(`[Telerivet] ✅ Auto-verified via SMS reply: ${normalized}`);
      }
    }

    // Telerivet expects a 200 response
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[Webhook Error]', err.message);
    res.status(200).json({ success: true }); // Always 200 to prevent Telerivet retries
  }
});

// ─── 404 & Error Handlers ─────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: 'Endpoint not found.' }));
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3002');
app.listen(PORT, () => {
  console.log('\n' +
    '  ☕  Buna Wallet OTP Server\n' +
    `  🚀  Running on http://localhost:${PORT}\n` +
    `  🌍  Production: https://bunatechhub.net\n` +
    `  📡  Telerivet Webhook: https://bunatechhub.net/webhook/telerivet\n` +
    `  🆔  Project ID: ${process.env.TELERIVET_PROJECT_ID || '(not set)'}\n`
  );
});
