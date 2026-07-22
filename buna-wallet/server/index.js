require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');
const db = require('./db'); // Connects to existing Buna Bingo Postgres DB
const { parseTelebirrSms } = require('./telebirrParser');
const { initTables } = require('./setup_db');

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

// Map<sessionId, { status: 'pending' | 'verified', token: string | null, phone: string | null, expiresAt: number }>
const telegramAuthSessions = new Map();

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

// ─── Online Receipt Verification (Security against SMS Spoofing) ────────────
async function verifyReceiptOnline(transactionId) {
  const engineHost = process.env.BUNA_ENGINE_HOST || 'https://rexhetmfgnf.bunatech.net.et';
  const engineKey = process.env.BUNA_ENGINE_KEY || '9f7a2d8e4c6b1a0f9e8d7c6b5a43210fe9';
  const host = engineHost.replace(/\/$/, '');
  
  const scraperUrl = `${host}/validate/${transactionId}`;
  const altScraperUrl = `${host}/?txnId=${transactionId}`;
  
  try {
    console.log(`[Verify] Checking ${transactionId} via ${scraperUrl}...`);
    let res = await fetch(scraperUrl, {
      headers: { 'x-api-key': engineKey },
      timeout: 5000
    });
    
    if (!res.ok) {
      console.log(`[Verify] Primary scraper failed, trying alt: ${altScraperUrl}`);
      res = await fetch(altScraperUrl, { timeout: 5000 });
    }
    
    if (res.ok) {
      const responseData = await res.json();
      console.log(`[Verify] Scraper response: ${JSON.stringify(responseData)}`);
      
      const isSuccess = responseData?.success === true || responseData?.status === 'success' || responseData?.valid === true;
      const matchesTxn = responseData?.data?.transactionId === transactionId || 
                         responseData?.transactionId === transactionId ||
                         responseData?.txnId === transactionId;
      
      if (isSuccess || matchesTxn) {
        return true; // Verified successfully!
      }
    }
  } catch (err) {
    console.warn(`[Verify] Engine check failed for ${transactionId}: ${err.message}`);
  }
  
  return false;
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
      webhook:   'https://api.bunatechhub.net/api/telerivet/webhook',
    },
  });
});

// ── TELEGRAM NATIVE AUTH ─────────────────────────────────────────────────────

// App polls this endpoint to check if the Telegram Bot has verified the session
app.get('/api/auth/telegram/poll/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = telegramAuthSessions.get(sessionId);

  if (!session) {
    return res.json({ success: true, status: 'pending' });
  }

  if (Date.now() > session.expiresAt) {
    telegramAuthSessions.delete(sessionId);
    return res.status(400).json({ success: false, message: 'Session expired' });
  }

  if (session.status === 'verified') {
    // Delete it so it can't be used twice
    telegramAuthSessions.delete(sessionId);
    return res.json({
      success: true,
      token: session.token,
      phone: session.phone || 'Telegram User',
      isNewUser: false // Adjust based on your DB logic later
    });
  }

  // Still pending
  return res.json({ success: true, status: 'pending' });
});

// Telegram Bot calls this endpoint to inject the token once the user clicks "Start"
app.post('/api/auth/telegram/verify', express.json(), async (req, res) => {
  try {
    const { sessionId, telegramId, username } = req.body;
    
    // Security check: You should require a secret header here to ensure only YOUR bot can call this
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.JWT_SECRET}`) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    let session = telegramAuthSessions.get(sessionId);
    if (!session) {
      session = { expiresAt: Date.now() + 5 * 60 * 1000 };
      telegramAuthSessions.set(sessionId, session);
    }

    // Usually you'd look up the user in your DB by telegramId here.
    // For now, we generate a JWT for them.
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: `tg_${telegramId}`, phone: username || 'Telegram User' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );

    // Update session
    session.status = 'verified';
    session.token = token;
    session.phone = username || 'Telegram User';

    res.json({ success: true });
  } catch (err) {
    console.error('[Telegram Auth Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
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

    // --- TEST NUMBER BYPASS ---
    const testNumbers = ['+251912939267'];
    const isTestNumber = testNumbers.includes(normalizedPhone);
    
    const code = isTestNumber ? '123456' : generateOTP();
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    // Store OTP (overwrite any previous pending code)
    otpStore.set(normalizedPhone, { code, expiresAt, attempts: 0, messageId: null });

    if (isTestNumber) {
      console.log(`[OTP] 🧪 TEST BYPASS for ${normalizedPhone} | Code: ${code}`);
      return res.json({
        success: true,
        message: `Verification code sent to ${normalizedPhone.slice(0, 7)}****`,
        phone: normalizedPhone,
        expiresInSeconds: OTP_EXPIRY_MS / 1000,
        messageId: 'test-bypass',
      });
    }
    // --------------------------

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

    // Check if user exists in the Buna Bingo Postgres Database
    let userId = null;
    let isNewUser = false;
    let appWalletBalance = 0;
    let userObj = null;

    // Look up by phone number. Note: Buna Bingo stores it as BigInt (telegram_id) or string (phone/phone_number)
    const userResult = await db.query(
      `SELECT id, first_name, last_name, username, phone FROM users WHERE phone = $1 OR phone_number = $1 OR telegram_id::text = $2 LIMIT 1`,
      [normalizedPhone, normalizedPhone.replace('+', '')]
    );

    if (userResult.rows.length > 0) {
      userObj = userResult.rows[0];
      userId = userObj.id;
      isNewUser = false;
      console.log(`[DB] Existing user found: ${userId}`);
    } else {
      // Create new user in Buna Bingo DB so they can also use the bot later!
      const newUserIdRes = await db.query(
        `INSERT INTO users (phone, phone_number, first_name, last_name, telegram_id) VALUES ($1, $1, $2, $3, $4) RETURNING id, first_name, last_name, phone`,
        [normalizedPhone, 'Buna', 'User', Date.now() + Math.floor(Math.random() * 1000)]
      );
      userObj = newUserIdRes.rows[0];
      userId = userObj.id;
      isNewUser = true;
      console.log(`[DB] New user created: ${userId}`);
    }

    // Ensure they have an AppWallet (so we don't mess with Buna Bingo wallets)
    const walletRes = await db.query(
      `SELECT balance, pin FROM app_wallets WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    let hasPin = false;
    if (walletRes.rows.length > 0) {
      appWalletBalance = parseFloat(walletRes.rows[0].balance || '0');
      hasPin = !!walletRes.rows[0].pin;
    } else {
      // Create their React Native wallet
      await db.query(
        `INSERT INTO app_wallets (user_id, balance) VALUES ($1, 0.00)`,
        [userId]
      );
      appWalletBalance = 0.00;
    }

    const sessionToken = Buffer.from(`${userId}:${Date.now()}`).toString('base64');
    const name = (userObj && (userObj.first_name || userObj.last_name))
      ? `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim()
      : 'Buna User';
    const walletId = `BW-${normalizedPhone.slice(-7)}`;

    res.json({
      success: true,
      message: 'Phone verified successfully.',
      phone: normalizedPhone,
      userId: userId,
      name: name,
      walletId: walletId,
      balance: appWalletBalance,
      totalAssets: appWalletBalance,
      token: sessionToken,
      isNewUser: isNewUser,
    });
  } catch (error) {
    console.error('[OTP Verify Error]', error);
    res.status(500).json({ success: false, message: 'Verification failed. Please try again.' });
  }
});

// ── GET /api/user/profile ───────────────────────────────────────────────────
app.get('/api/user/profile', async (req, res) => {
  try {
    const { phone, userId } = req.query;

    if (!phone && !userId) {
      return res.status(400).json({ success: false, message: 'Phone or userId is required.' });
    }

    let queryText = 'SELECT id, first_name, last_name, username, phone FROM users WHERE id = $1 LIMIT 1';
    let queryParams = [userId];

    if (phone) {
      const normalizedPhone = normalizePhone(phone);
      queryText = 'SELECT id, first_name, last_name, username, phone FROM users WHERE phone = $1 OR phone_number = $1 LIMIT 1';
      queryParams = [normalizedPhone];
    }

    const userResult = await db.query(queryText, queryParams);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const userObj = userResult.rows[0];
    const uId = userObj.id;

    const walletRes = await db.query(
      `SELECT balance FROM app_wallets WHERE user_id = $1 LIMIT 1`,
      [uId]
    );

    const balance = walletRes.rows.length > 0 ? parseFloat(walletRes.rows[0].balance || '0') : 0.00;
    const name = (userObj.first_name || userObj.last_name)
      ? `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim()
      : 'Buna User';
    const walletId = `BW-${(userObj.phone || '').slice(-7)}`;

    res.json({
      success: true,
      userId: uId,
      phone: userObj.phone,
      name: name,
      walletId: walletId,
      balance: balance,
      totalAssets: balance,
    });
  } catch (error) {
    console.error('[Profile Fetch Error]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile.' });
  }
});

// ── PUT /api/user/profile ───────────────────────────────────────────────────
app.put('/api/user/profile', async (req, res) => {
  try {
    const { userId, name } = req.body;
    if (!userId || !name) {
      return res.status(400).json({ success: false, message: 'userId and name are required.' });
    }

    const parts = name.trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    await db.query(
      `UPDATE users SET first_name = $1, last_name = $2 WHERE id = $3`,
      [firstName, lastName, userId]
    );

    res.json({ success: true, message: 'Profile updated successfully.', name });
  } catch (error) {
    console.error('[Profile Update Error]', error);
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

// ── GET /api/users/search ───────────────────────────────────────────────────
app.get('/api/users/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json({ success: true, users: [] });
    }

    const searchTerm = `%${q.trim()}%`;
    const searchNormalizedPhone = `%${q.trim().replace(/\D/g, '')}%`;

    const userResult = await db.query(
      `SELECT id, first_name, last_name, username, phone 
       FROM users 
       WHERE first_name ILIKE $1 
          OR last_name ILIKE $1 
          OR username ILIKE $1 
          OR phone LIKE $2
          OR phone_number LIKE $2
       LIMIT 10`,
      [searchTerm, searchNormalizedPhone]
    );

    const users = userResult.rows.map(u => ({
      id: u.id,
      name: (u.first_name || u.last_name) ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : 'Buna User',
      username: u.username || '',
      phone: u.phone || '',
      walletId: `BW-${(u.phone || '').slice(-7)}`
    }));

    res.json({ success: true, users });
  } catch (error) {
    console.error('[User Search Error]', error);
    res.status(500).json({ success: false, message: 'Failed to search users.' });
  }
});


// ── POST /api/wallet/deposit ─────────────────────────────────────────────────
app.post('/api/wallet/deposit', async (req, res) => {
  try {
    const { userId, amount, txnId } = req.body;
    if (!userId || !amount || !txnId) {
      return res.status(400).json({ success: false, message: 'userId, amount, and txnId are required.' });
    }

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Deposit amount must be positive.' });
    }

    // Verify user exists
    const userRes = await db.query(`SELECT id FROM users WHERE id = $1`, [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Insert pending deposit
    await db.query(
      `INSERT INTO app_deposits (user_id, amount, txn_id, status) VALUES ($1, $2, $3, 'pending')`,
      [userId, amount, txnId]
    );

    console.log(`[App Deposit] Created pending deposit ${txnId} for user ${userId}`);

    res.json({
      success: true,
      message: 'Deposit request created. Waiting for SMS verification.',
      txnId
    });
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation (e.g., duplicate txn_id)
      return res.status(400).json({ success: false, message: 'This transaction ID has already been submitted.' });
    }
    console.error('[Deposit Error]', error);
    res.status(500).json({ success: false, message: 'Failed to create deposit request.' });
  }
});

// ── POST /api/wallet/withdraw ──────────────────────────────────────────────
app.post('/api/wallet/withdraw', async (req, res) => {
  try {
    const { userId, amount, paymentMethod, accountNumber } = req.body;
    if (!userId || !amount || !paymentMethod || !accountNumber) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Withdrawal amount must be positive.' });
    }

    // Begin transaction
    await db.query('BEGIN');

    // Lock and check wallet balance
    const walletRes = await db.query(
      `SELECT balance FROM app_wallets WHERE user_id = (SELECT id FROM users WHERE phone = $1 OR id::text = $1) FOR UPDATE`,
      [userId]
    );

    if (walletRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Wallet not found.' });
    }

    const currentBalance = parseFloat(walletRes.rows[0].balance);
    if (currentBalance < amount) {
      await db.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Insufficient balance.' });
    }

    // Deduct balance
    const newBalance = currentBalance - amount;
    await db.query(
      `UPDATE app_wallets SET balance = $1, total_withdrawn = total_withdrawn + $2, updated_at = NOW() WHERE user_id = (SELECT id FROM users WHERE phone = $3 OR id::text = $3)`,
      [newBalance, amount, userId]
    );

    // Insert pending withdrawal request
    const withdrawRes = await db.query(
      `INSERT INTO app_withdrawals (user_id, amount, payment_method, account_number, status)
       VALUES ((SELECT id FROM users WHERE phone = $1 OR id::text = $1), $2, $3, $4, 'pending') RETURNING id`,
      [userId, amount, paymentMethod, accountNumber]
    );
    const withdrawalId = withdrawRes.rows[0].id;

    // Log transaction
    await db.query(
      `INSERT INTO app_transactions (user_id, type, amount, balance_before, balance_after, status, reference_id, description)
       VALUES ((SELECT id FROM users WHERE phone = $1 OR id::text = $1), 'WITHDRAWAL', $2, $3, $4, 'pending', $5, $6)`,
      [userId, amount, currentBalance, newBalance, withdrawalId, `Withdrawal to ${paymentMethod}`]
    );

    await db.query('COMMIT');
    console.log(`[App Withdrawal] Created pending withdrawal ${withdrawalId} for user ${userId}`);

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully.',
      withdrawalId,
      newBalance
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('[Withdraw Error]', error);
    res.status(500).json({ success: false, message: 'Failed to create withdrawal request.' });
  }
});

// ── POST /api/wallet/transfer ────────────────────────────────────────────────
app.post('/api/wallet/transfer', async (req, res) => {
  try {
    const { senderId, recipientPhone, amount } = req.body;
    if (!senderId || !recipientPhone || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Transfer amount must be positive.' });
    }

    const normalizedRecipient = normalizePhone(recipientPhone);
    if (senderId === normalizedRecipient) {
      return res.status(400).json({ success: false, message: 'Cannot transfer to yourself.' });
    }

    await db.query('BEGIN');

    // Get Sender
    const senderRes = await db.query(
      `SELECT w.balance, u.id FROM app_wallets w JOIN users u ON w.user_id = u.id WHERE u.phone = $1 OR u.id::text = $1 FOR UPDATE`,
      [senderId]
    );
    if (senderRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Sender wallet not found.' });
    }
    
    const sender = senderRes.rows[0];
    const senderBalance = parseFloat(sender.balance);
    
    if (senderBalance < amount) {
      await db.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Insufficient balance for transfer.' });
    }

    // Get Recipient
    const recipientRes = await db.query(
      `SELECT w.balance, u.id FROM app_wallets w JOIN users u ON w.user_id = u.id WHERE u.phone = $1 FOR UPDATE`,
      [normalizedRecipient]
    );
    if (recipientRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Recipient not found in Buna Wallet.' });
    }

    const recipient = recipientRes.rows[0];
    const recipientBalance = parseFloat(recipient.balance);

    // Execute transfer
    const newSenderBalance = senderBalance - amount;
    const newRecipientBalance = recipientBalance + amount;

    await db.query(`UPDATE app_wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2`, [newSenderBalance, sender.id]);
    await db.query(`UPDATE app_wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2`, [newRecipientBalance, recipient.id]);

    // Log transactions
    await db.query(
      `INSERT INTO app_transactions (user_id, type, amount, balance_before, balance_after, status, description)
       VALUES ($1, 'TRANSFER_OUT', $2, $3, $4, 'completed', $5)`,
      [sender.id, amount, senderBalance, newSenderBalance, `Sent to ${normalizedRecipient}`]
    );

    await db.query(
      `INSERT INTO app_transactions (user_id, type, amount, balance_before, balance_after, status, description)
       VALUES ($1, 'TRANSFER_IN', $2, $3, $4, 'completed', $5)`,
      [recipient.id, amount, recipientBalance, newRecipientBalance, `Received from ${senderId}`]
    );

    await db.query('COMMIT');
    console.log(`[App Transfer] ${amount} ETB from ${senderId} to ${normalizedRecipient}`);

    res.json({
      success: true,
      message: 'Transfer successful.',
      newBalance: newSenderBalance
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('[Transfer Error]', error);
    res.status(500).json({ success: false, message: 'Transfer failed.' });
  }
});

// ── POST /api/wallet/bridge/to-casino ────────────────────────────────────────
app.post('/api/wallet/bridge/to-casino', async (req, res) => {
  try {
    const { userId, amount } = req.body; // userId here is phone or ID
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount.' });
    }

    await db.query('BEGIN');

    // 1. Get User ID (UUID) and lock App Wallet
    const appWalletRes = await db.query(
      `SELECT aw.balance, u.id as user_uuid FROM app_wallets aw JOIN users u ON aw.user_id = u.id WHERE u.phone = $1 OR u.id::text = $1 FOR UPDATE`,
      [userId]
    );

    if (appWalletRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'App Wallet not found.' });
    }

    const { balance: appBalance, user_uuid } = appWalletRes.rows[0];
    if (parseFloat(appBalance) < amount) {
      await db.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Insufficient balance in App Wallet.' });
    }

    // 2. Lock Casino Wallet
    const casinoWalletRes = await db.query(
      `SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [user_uuid]
    );

    if (casinoWalletRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Casino Wallet not found for this user.' });
    }

    const casinoBalance = parseFloat(casinoWalletRes.rows[0].balance);

    // 3. Move funds
    const newAppBalance = parseFloat(appBalance) - amount;
    const newCasinoBalance = casinoBalance + amount;

    await db.query(`UPDATE app_wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2`, [newAppBalance, user_uuid]);
    await db.query(`UPDATE wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2`, [newCasinoBalance, user_uuid]);

    // 4. Log transactions
    await db.query(
      `INSERT INTO app_transactions (user_id, type, amount, balance_before, balance_after, status, description)
       VALUES ($1, 'BRIDGE_OUT', $2, $3, $4, 'completed', 'Transfer to Casino Games')`,
      [user_uuid, amount, appBalance, newAppBalance]
    );

    await db.query('COMMIT');
    console.log(`[Casino Bridge] ${amount} ETB moved from App Wallet to Casino for user ${user_uuid}`);

    res.json({ success: true, message: 'Transferred to Casino successfully!', newBalance: newAppBalance });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('[Bridge Error]', error);
    res.status(500).json({ success: false, message: 'Bridge transfer failed.' });
  }
});

// ── POST /api/wallet/bridge/to-wallet ────────────────────────────────────────
app.post('/api/wallet/bridge/to-wallet', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount.' });
    }

    await db.query('BEGIN');

    // 1. Get User ID (UUID) and lock App Wallet
    const appWalletRes = await db.query(
      `SELECT aw.balance, u.id as user_uuid FROM app_wallets aw JOIN users u ON aw.user_id = u.id WHERE u.phone = $1 OR u.id::text = $1 FOR UPDATE`,
      [userId]
    );

    if (appWalletRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'App Wallet not found.' });
    }

    const { balance: appBalance, user_uuid } = appWalletRes.rows[0];

    // 2. Lock Casino Wallet
    const casinoWalletRes = await db.query(
      `SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [user_uuid]
    );

    if (casinoWalletRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Casino Wallet not found.' });
    }

    const casinoBalance = parseFloat(casinoWalletRes.rows[0].balance);
    if (casinoBalance < amount) {
      await db.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Insufficient balance in Casino.' });
    }

    // 3. Move funds
    const newAppBalance = parseFloat(appBalance) + amount;
    const newCasinoBalance = casinoBalance - amount;

    await db.query(`UPDATE app_wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2`, [newAppBalance, user_uuid]);
    await db.query(`UPDATE wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2`, [newCasinoBalance, user_uuid]);

    // 4. Log transactions
    await db.query(
      `INSERT INTO app_transactions (user_id, type, amount, balance_before, balance_after, status, description)
       VALUES ($1, 'BRIDGE_IN', $2, $3, $4, 'completed', 'Withdraw from Casino Games')`,
      [user_uuid, amount, appBalance, newAppBalance]
    );

    await db.query('COMMIT');
    console.log(`[Casino Bridge] ${amount} ETB moved from Casino to App Wallet for user ${user_uuid}`);

    res.json({ success: true, message: 'Transferred to App Wallet successfully!', newBalance: newAppBalance });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('[Bridge Error]', error);
    res.status(500).json({ success: false, message: 'Bridge transfer failed.' });
  }
});

// ── POST /api/telerivet/webhook ────────────────────────────────────────────────
// Configured in Telerivet → Developer API → Webhook URL:
//   https://api.bunatechhub.net/api/telerivet/webhook
//
// Telerivet calls this endpoint for:
//   - Message status updates (delivered, failed)
//   - Incoming replies from users
app.post('/api/telerivet/webhook', async (req, res) => {
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

    // Handle incoming replies or Telebirr SMS
    if (dir === 'incoming' || event === 'incoming_message') {
      console.log(`[Telerivet] Incoming from ${from}: "${content}"`);
      
      // 1. Check if it's an OTP reply
      const normalized = normalizePhone(from);
      const stored = otpStore.get(normalized);
      const otpCode = content.replace(/\D/g, '').trim();

      if (stored && otpCode.length === OTP_LENGTH && stored.code === otpCode) {
        otpStore.delete(normalized);
        console.log(`[Telerivet] ✅ Auto-verified via SMS reply: ${normalized}`);
      }

      // 2. Check if it's a Telebirr Deposit SMS
      const parsedTelebirr = parseTelebirrSms(content);
      if (parsedTelebirr && parsedTelebirr.transactionId) {
        console.log(`[Telebirr Auto-Verify] Detected TxnId: ${parsedTelebirr.transactionId}, Amount: ${parsedTelebirr.amount}`);
        
        // Find a pending deposit in the React Native Wallet tables that matches this TxnId
        const depositRes = await db.query(
          `SELECT id, user_id, amount FROM app_deposits WHERE txn_id = $1 AND status = 'pending' LIMIT 1`,
          [parsedTelebirr.transactionId]
        );

        if (depositRes.rows.length > 0) {
          const deposit = depositRes.rows[0];
          
          // Verify amount matches (with small tolerance if needed)
          if (Math.abs(parseFloat(deposit.amount) - parsedTelebirr.amount) <= 5) {
            console.log(`[Telebirr Auto-Verify] Local match found! Calling external Scraper Engine for security verification...`);
            
            // SECURITY CHECK: Verify the receipt actually exists on Ethio Telecom via Buna Engine Scraper
            const isOnlineVerified = await verifyReceiptOnline(parsedTelebirr.transactionId);
            
            if (isOnlineVerified) {
              console.log(`[Telebirr Auto-Verify] Online Verification Passed! Crediting User ${deposit.user_id} Wallet...`);
              
              // Execute automated crediting in a transaction
              try {
                await db.query('BEGIN');
                
                // 1. Mark deposit as approved
                await db.query(
                  `UPDATE app_deposits SET status = 'approved', updated_at = NOW() WHERE id = $1`,
                  [deposit.id]
                );
                
                // 2. Update wallet balance
                const walletUpdate = await db.query(
                  `UPDATE app_wallets SET balance = balance + $1, total_deposited = total_deposited + $1, updated_at = NOW() WHERE user_id = $2 RETURNING balance`,
                  [deposit.amount, deposit.user_id]
                );
                
                const newBalance = walletUpdate.rows[0].balance;
                
                // 3. Log transaction
                await db.query(
                  `INSERT INTO app_transactions (user_id, type, amount, balance_before, balance_after, status, reference_id, description)
                   VALUES ($1, 'DEPOSIT', $2, $3, $4, 'completed', $5, 'Automated Telebirr SMS + Online Verification')`,
                  [deposit.user_id, deposit.amount, newBalance - deposit.amount, newBalance, parsedTelebirr.transactionId]
                );
                
                await db.query('COMMIT');
                console.log(`[Telebirr Auto-Verify] ✅ Success! User ${deposit.user_id} balance is now ${newBalance} ETB.`);
              } catch (err) {
                await db.query('ROLLBACK');
                console.error(`[Telebirr Auto-Verify] ❌ DB Transaction Failed:`, err);
              }
            } else {
              console.warn(`[Telebirr Auto-Verify] 🚨 ONLINE VERIFICATION FAILED. Receipt ${parsedTelebirr.transactionId} could not be validated with the external engine! Rejecting automated credit.`);
              // Optional: Mark deposit as failed/flagged
            }
          } else {
            console.warn(`[Telebirr Auto-Verify] Amount mismatch! Expected ${deposit.amount}, got ${parsedTelebirr.amount}`);
          }
        } else {
          console.log(`[Telebirr Auto-Verify] No pending deposit found for TxnId: ${parsedTelebirr.transactionId}`);
        }
      }
    }

    // Telerivet expects a 200 response
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[Webhook Error]', err.message);
    res.status(200).json({ success: true }); // Always 200 to prevent Telerivet retries
  }
});

const bcrypt = require('bcryptjs');

// ── POST /api/auth/check-phone ──────────────────────────────────────────────────
app.post('/api/auth/check-phone', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone required' });
    
    const normalizedPhone = normalizePhone(phone);
    
    const userResult = await db.query(
      `SELECT id FROM users WHERE phone = $1 OR phone_number = $1 OR telegram_id::text = $2 LIMIT 1`,
      [normalizedPhone, normalizedPhone.replace('+', '')]
    );

    if (userResult.rows.length === 0) {
      return res.json({ success: true, exists: false, hasPin: false });
    }

    const userId = userResult.rows[0].id;
    const walletRes = await db.query(`SELECT pin FROM app_wallets WHERE user_id = $1`, [userId]);
    
    let hasPin = false;
    if (walletRes.rows.length > 0 && walletRes.rows[0].pin) {
      hasPin = true;
    }
    
    res.json({ success: true, exists: true, hasPin });
  } catch (err) {
    console.error('[Check Phone Error]', err);
    res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// ── POST /api/auth/setup-pin ──────────────────────────────────────────────────
app.post('/api/auth/setup-pin', async (req, res) => {
  try {
    const { token, pin } = req.body;
    if (!token || !pin) return res.status(400).json({ success: false, message: 'Token and pin required' });
    
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const userId = decoded.split(':')[0];
    
    if (!userId) return res.status(401).json({ success: false, message: 'Invalid token' });
    
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(pin, salt);
    
    await db.query(`UPDATE app_wallets SET pin = $1 WHERE user_id = $2`, [hashedPin, userId]);
    
    res.json({ success: true, message: 'PIN configured successfully.' });
  } catch (err) {
    console.error('[Setup PIN Error]', err);
    res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// ── POST /api/auth/change-pin ─────────────────────────────────────────────────
// Body: { token, currentPin, newPin }
// Verifies currentPin against stored hash, then saves hashed newPin
app.post('/api/auth/change-pin', async (req, res) => {
  try {
    const { token, currentPin, newPin } = req.body;
    if (!token || !currentPin || !newPin) {
      return res.status(400).json({ success: false, message: 'token, currentPin and newPin are required' });
    }

    // Decode token → userId
    let userId;
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      userId = decoded.split(':')[0];
    } catch (_) {}
    if (!userId) return res.status(401).json({ success: false, message: 'Invalid or expired session' });

    // Validate new PIN length
    if (!/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ success: false, message: 'New PIN must be exactly 4 digits' });
    }

    // Ensure current and new are different
    if (currentPin === newPin) {
      return res.status(400).json({ success: false, message: 'New PIN must be different from your current PIN' });
    }

    // Fetch stored hashed PIN
    const walletRes = await db.query(
      `SELECT pin FROM app_wallets WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    if (walletRes.rows.length === 0 || !walletRes.rows[0].pin) {
      return res.status(400).json({ success: false, message: 'No PIN found for this account' });
    }

    // Verify current PIN
    const isMatch = await bcrypt.compare(currentPin, walletRes.rows[0].pin);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Your current PIN is incorrect' });
    }

    // Hash and save the new PIN
    const salt = await bcrypt.genSalt(10);
    const hashedNew = await bcrypt.hash(newPin, salt);
    await db.query(`UPDATE app_wallets SET pin = $1 WHERE user_id = $2`, [hashedNew, userId]);

    res.json({ success: true, message: 'PIN changed successfully.' });
  } catch (err) {
    console.error('[Change PIN Error]', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── POST /api/auth/verify-pin ──────────────────────────────────────────────────
app.post('/api/auth/verify-pin', async (req, res) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) return res.status(400).json({ success: false, message: 'Phone and pin required' });
    
    const normalizedPhone = normalizePhone(phone);
    
    const userResult = await db.query(
      `SELECT id, first_name, last_name FROM users WHERE phone = $1 OR phone_number = $1 OR telegram_id::text = $2 LIMIT 1`,
      [normalizedPhone, normalizedPhone.replace('+', '')]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const userObj = userResult.rows[0];
    const userId = userObj.id;
    
    const walletRes = await db.query(`SELECT balance, pin FROM app_wallets WHERE user_id = $1 LIMIT 1`, [userId]);
    
    if (walletRes.rows.length === 0 || !walletRes.rows[0].pin) {
      return res.status(400).json({ success: false, message: 'No PIN set up for this user' });
    }
    
    const isMatch = await bcrypt.compare(pin, walletRes.rows[0].pin);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect PIN' });
    }
    
    const sessionToken = Buffer.from(`${userId}:${Date.now()}`).toString('base64');
    const name = (userObj.first_name || userObj.last_name) ? `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() : 'Buna User';
    const walletId = `BW-${normalizedPhone.slice(-7)}`;
    const appWalletBalance = parseFloat(walletRes.rows[0].balance || '0');
    
    res.json({
      success: true,
      message: 'Logged in successfully.',
      phone: normalizedPhone,
      userId: userId,
      name: name,
      walletId: walletId,
      balance: appWalletBalance,
      totalAssets: appWalletBalance,
      token: sessionToken,
      hasPin: true,
    });
  } catch (err) {
    console.error('[Verify PIN Error]', err);
    res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// ─── 404 & Error Handlers ─────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: 'Endpoint not found.' }));
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3004');
app.listen(PORT, async () => {
  console.log('\n' +
    '  ☕  Buna Wallet OTP Server\n' +
    `  🚀  Running on http://localhost:${PORT}\n` +
    `  🌍  Production: https://api.bunatechhub.net\n` +
    `  📡  Telerivet Webhook: https://api.bunatechhub.net/api/telerivet/webhook\n` +
    `  🆔  Project ID: ${process.env.TELERIVET_PROJECT_ID || '(not set)'}\n`
  );
  await initTables();
});
