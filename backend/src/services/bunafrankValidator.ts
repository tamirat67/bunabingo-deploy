/**
 * BunaFrank SMS & Receipt Validator
 *
 * Supports three Telebirr SMS languages:
 *  - English:  "Dear NAME You have transferred ETB 15.00 to ..."
 *  - Amharic:  "ውድ NAME ወደ ...(2519****8294) 10.00 ብር"
 *  - Afaan Oromo: "Kabajamoo dhachaa Gara NAME (2519****5111)tti Qarshii 100.00 gaafa guyyaa DD/MM/YYYY HH:mm:ss ..."
 */

import axios from 'axios';
import https from 'https';
import { logger } from '../lib/logger';
import prisma from '../lib/prisma';
import { config } from '../config';
import { findAgentAncestor } from './user.service';

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface TelebirrSmsData {
  senderName: string;
  amount: number;
  recipientName: string;
  recipientPhoneMasked: string;   // e.g. "2519****8294"
  recipientPhoneLast4: string;    // e.g. "8294"
  transactionId: string;          // e.g. "DE84OPTF9M"
  dateTime: string;               // e.g. "08/05/2026 17:20:46"
  serviceFee: number;
  receiptUrl: string;
}

export interface ValidationResult {
  valid: boolean;
  data?: TelebirrSmsData;
  error?: string;
  onlineVerified?: boolean;
}

// ─── Parser ────────────────────────────────────────────────────────────────────
export function parseTelebirrSms(smsText: string): TelebirrSmsData | null {
  try {
    // Normalize text: replace newlines/tabs with space and trim
    const text = smsText.replace(/\s+/g, ' ').trim();

    // ── Ethiopian phone formats accepted: 251XXXXXXXX, 09XXXXXXXX, +251XXXXXXXX
    // ── Ethiopian phone formats accepted: 251XXXXXXXX, 09XXXXXXXX, +251XXXXXXXX
    // Masked in SMS as: 2519****8294 | 09****8294 | +251****8294 | +251****55111
    // Oromo SMS may show only 2 trailing digits (e.g. 0969****11); accept 2–5
    const phonePattern = `(?:(?:\\+251|251|0)\\d{0,3}[\\*x]+(\\d{2,5}))`;

    let transactionId = '';
    let recipientName = 'Unknown';
    let recipientPhoneMasked = '';
    let recipientPhoneLast4 = '';
    let amount = 0;
    let dateTime = '';
    let senderName = 'Unknown';
    let serviceFee = 0;

    // ══════════════════════════════════════════════════════════
    // LANGUAGE DETECTION & PARSING
    // ══════════════════════════════════════════════════════════

    const isOromo = /Kabajamoo|Qarshii|Lakkoofsi|gaafa guyyaa|ergitanii/i.test(text);
    const isAmharic = /ወደ|ብር|ቁጥርዎ|ውድ/.test(text);

    if (isOromo) {
      // ── AFAAN OROMO ────────────────────────────────────────────────────────
      // Greeting: "Kabajamoo dhachaa"
      // e.g. "Gara Luel Gebrelibanos (2519****5111)tti  Qarshii 100.00"
      // TxnID: "Lakkoofsi sochii maallaqaa keessan DFD0UPGKGS' dha."
      // Date:  "gaafa guyyaa 13/06/2026 17:03:22"
      // Fee:   "Kaffaltiin tajaajilla(VAT 15% dabalatee) Qarshii 1.00"

      // 1. Transaction ID
      const txnOr = text.match(/Lakkoofsi\s+sochii\s+maallaqaa\s+keessan\s+([A-Z0-9]{6,})/i);
      if (!txnOr) return null;
      transactionId = txnOr[1].replace(/['^.,]/g, '').trim();

      // 2. Recipient name + phone
      const orRecipientPattern = new RegExp(
        `Gara\\s+([^(]+?)\\s*\\((${phonePattern})\\)tti`,
        'i'
      );
      const orMatch = text.match(orRecipientPattern);
      if (orMatch) {
        recipientName = orMatch[1].trim();
        recipientPhoneMasked = orMatch[2];
        recipientPhoneLast4 = orMatch[3];
      }

      // 3. Amount — first Qarshii occurrence (the transfer amount, not fee)
      const orAmounts = [...text.matchAll(/Qarshii\s+([\d,]+\.?\d*)/gi)];
      if (orAmounts.length > 0) {
        amount = parseFloat(orAmounts[0][1].replace(/,/g, ''));
      }

      // 4. DateTime — "gaafa guyyaa DD/MM/YYYY HH:mm:ss"
      const orDate = text.match(/gaafa guyyaa\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i);
      dateTime = orDate?.[1] ?? '';

      // 5. Sender — Oromo SMS does not include sender name, use placeholder
      senderName = 'Unknown';

      // 6. Service Fee — second Qarshii occurrence
      if (orAmounts.length > 1) {
        serviceFee = parseFloat(orAmounts[1][1].replace(/,/g, ''));
      }

    } else if (isAmharic) {
      // ── AMHARIC ────────────────────────────────────────────────────────────
      // TxnID: "የሂሳብ እንቅስቃሴ ቁጥርዎ DEB5T78F8X ነዉ።"
      const txnAm = text.match(/ቁጥርዎ\s+([A-Z0-9]{6,})/i);
      if (!txnAm) return null;
      transactionId = txnAm[1].trim();

      // Recipient + Amount: "ወደ Name(2519****8294) 10.00 ብር"
      const amPattern = new RegExp(
        `ወደ\\s+([^(]+?)\\s*\\((${phonePattern})\\)\\s+([\\d,]+\\.?\\d*)\\s+ብር`,
        'i'
      );
      const amMatch = text.match(amPattern);
      if (amMatch) {
        recipientName = amMatch[1].trim();
        recipientPhoneMasked = amMatch[2];
        recipientPhoneLast4 = amMatch[3];
        amount = parseFloat(amMatch[4].replace(/,/g, ''));
      }

      // DateTime: "በ 11/05/2026 21:49:35"
      const amDate = text.match(/በ\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i);
      dateTime = amDate?.[1] ?? '';

      // Sender: "ውድ NAME"
      const amSender = text.match(/ውድ\s*([^\s\n,]+)/i);
      senderName = amSender?.[1]?.trim() ?? 'Unknown';

      // Fee
      const amFee = text.match(/የአገልግሎት ክፍያው\s+([\d.]+)/i);
      serviceFee = amFee ? parseFloat(amFee[1]) : 0;

    } else {
      // ── ENGLISH ────────────────────────────────────────────────────────────
      // ── ENGLISH ────────────────────────────────────────────────────────────
      // TxnID: "Your transaction number is DE84OPTF9M." OR "Your Account Activity Number is DG88NERGX0."
      const txnEn = text.match(/(?:transaction number is|Account Activity Number is)\s+([A-Z0-9]{6,})/i);
      if (!txnEn) return null;
      transactionId = txnEn[1].trim();

      // Recipient + Amount: "transferred ETB 15.00 to Name (2519****8294)" OR "sent 150.00 Birr to Name (+251****55111)"
      const enPatternOld = new RegExp(
        `transferred\\s+ETB\\s+([\\d,]+\\.?\\d*)\\s+to\\s+([^(]+?)\\s*\\((${phonePattern})\\)`,
        'i'
      );
      const enPatternNew = new RegExp(
        `sent\\s+([\\d,]+\\.?\\d*)\\s+(?:Birr|ETB)\\s+to\\s+([^(]+?)\\s*\\((${phonePattern})\\)`,
        'i'
      );
      
      let enMatch = text.match(enPatternOld);
      if (enMatch) {
        amount = parseFloat(enMatch[1].replace(/,/g, ''));
        recipientName = enMatch[2].trim();
        recipientPhoneMasked = enMatch[3];
        recipientPhoneLast4 = enMatch[4];
      } else {
        enMatch = text.match(enPatternNew);
        if (enMatch) {
          amount = parseFloat(enMatch[1].replace(/,/g, ''));
          recipientName = enMatch[2].trim();
          recipientPhoneMasked = enMatch[3];
          recipientPhoneLast4 = enMatch[4];
        }
      }

      // DateTime: "on 08/05/2026 17:20:46"
      const enDate = text.match(/on\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i);
      dateTime = enDate?.[1] ?? '';

      // Sender: "Dear NAME"
      const enSender = text.match(/Dear\s+([^\s\n,]+)/i);
      senderName = enSender?.[1]?.trim() ?? 'Unknown';

      // Fee
      const enFee = text.match(/service fee is(?: ETB)?\s+([\d.]+)/i);
      serviceFee = enFee ? parseFloat(enFee[1]) : 0;
    }

    // ── Final guard: must have valid txn + amount + phone ──────────────────
    if (!transactionId || amount === 0 || !recipientPhoneMasked) return null;

    // Receipt URL (present in all languages)
    const urlMatch = text.match(/(https:\/\/transactioninfo\.ethiotelecom\.et\/receipt\/[A-Z0-9]+)/i);
    const receiptUrl = urlMatch?.[1] ?? `https://transactioninfo.ethiotelecom.et/receipt/${transactionId}`;

    return {
      senderName,
      amount,
      recipientName,
      recipientPhoneMasked,
      recipientPhoneLast4,
      transactionId,
      dateTime,
      serviceFee,
      receiptUrl,
    };
  } catch (err) {
    logger.error('[BunaFrankValidator] Parse error:', err);
    return null;
  }
}

// ─── Online receipt verification ───────────────────────────────────────────────
export async function verifyReceiptOnline(receiptUrl: string, transactionId: string): Promise<boolean> {
  const maxRetries = 1;      // reduced: was 3 — one attempt is enough, we run in background
  const retryDelay = 1500;   // reduced: was 5000ms

  for (let i = 0; i < maxRetries; i++) {
    try {
      if (i > 0) {
        logger.info(`[BunaFrankValidator] Retry ${i}/${maxRetries} for ${transactionId}...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

      if (config.payment.bunaEngineHost) {
        try {
          const host = config.payment.bunaEngineHost.replace(/\/$/, '');
          const scraperUrl = `${host}/validate/${transactionId}`;
          const altScraperUrl = `${host}/?txnId=${transactionId}`;
          
          logger.info(`[BunaFrankValidator] Calling scraper: ${scraperUrl}`);
          
          let res = await axios.get(scraperUrl, { 
            timeout: 5000,   // reduced: was 10000ms
            headers: { 'x-api-key': config.payment.bunaEngineKey },
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
          }).catch(() => null);

          if (!res || !res.data) {
            logger.info(`[BunaFrankValidator] Primary scraper failed, trying alt: ${altScraperUrl}`);
            res = await axios.get(altScraperUrl, { 
              timeout: 5000,   // reduced: was 10000ms
              httpsAgent: new https.Agent({ rejectUnauthorized: false })
            }).catch(() => null);
          }
          
          const responseData = res?.data;
          logger.info(`[BunaFrankValidator] Scraper response: ${JSON.stringify(responseData)}`);

          // Be more lenient: if it returns success, or if it returns data that matches our transaction
          const isSuccess = responseData?.success === true || responseData?.status === 'success' || responseData?.valid === true;
          const matchesTxn = responseData?.data?.transactionId === transactionId || 
                             responseData?.transactionId === transactionId ||
                             responseData?.txnId === transactionId;
          
          if (isSuccess || matchesTxn) {
            logger.info(`[BunaFrankValidator] ✅ Verified via engine: ${transactionId}`);
            return true;
          }
        } catch (engineErr: any) {
          logger.warn(`[BunaFrankValidator] Engine check failed for ${transactionId}: ${engineErr.message}. Falling back to direct scrape.`);
        }
      }

      // Direct fallback to official site
      try {
        const res = await axios.get(receiptUrl, {
          timeout: 8000,   // reduced: was 15000ms
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        const html = String(res.data);
        const found = html.includes(transactionId);
        
        if (found || html.includes('Payment Successful') || html.includes('የተከፈለ')) {
          logger.info(`[BunaFrankValidator] ✅ Verified via official receipt: ${transactionId}`);
          return true;
        }
      } catch (scrapeErr: any) {
        logger.warn(`[BunaFrankValidator] Official scrape attempt ${i + 1} failed for ${transactionId}: ${scrapeErr.message}`);
      }
    } catch (err: any) {
      logger.error(`[BunaFrankValidator] Unexpected error in verification loop for ${transactionId}:`, err);
    }
  }
  
  logger.warn(`[BunaFrankValidator] ❌ Online verification failed for ${transactionId} after ${maxRetries} attempts.`);
  return false;
}

// ─── Self-verification: internal consistency of parsed fields ─────────────────
function selfVerifyParsed(data: TelebirrSmsData): { ok: boolean; issue?: string } {
  if (!data.amount || data.amount <= 0)
    return { ok: false, issue: '❌ ተሰልቶ የተገኘው ክፍያ ዜሮ ወይም ከዜሮ በታች ነው።' };
  if (data.amount > 500_000)
    return { ok: false, issue: '❌ ክፍያው ያልተለመደ ትልቅ መጠን አለው — ሳይጣምም SMS ያስገቡ።' };
  if (!data.transactionId || !/^[A-Z0-9]{6,20}$/.test(data.transactionId))
    return { ok: false, issue: '❌ የግብይት መለያ (ID) ቅርጽ ትክክል አይደለም — ሙሉ SMS ያስገቡ።' };
  // Accept: 251XXXXXXXX, 09XXXXXXXX, +251XXXXXXXX (all Ethiopian formats)
  if (!data.recipientPhoneMasked || !/^(\+?251|09)/.test(data.recipientPhoneMasked))
    return { ok: false, issue: '❌ የተቀባዩ ስልክ ቁጥር ቅርጽ ያልተለመደ ነው።' };
  if (!data.recipientName || data.recipientName.toLowerCase() === 'unknown')
    return { ok: false, issue: '❌ የተቀባዩ ስም ሊነበብ አልቻለም — ሙሉ SMS ያስገቡ።' };
  if (!data.recipientPhoneLast4 || data.recipientPhoneLast4.length < 2)
    return { ok: false, issue: '❌ የስልክ ቁጥሩ መጨረሻ ቁጥሮች ሊነበቡ አልቻሉም።' };
  if (!data.dateTime || data.dateTime.trim().length < 10)
    return { ok: false, issue: '❌ የግብይቱ ቀን/ሰዓት ሊነበብ አልቻለም — ሙሉ SMS ያስገቡ።' };
  if (data.serviceFee < 0)
    return { ok: false, issue: '❌ የአገልግሎት ክፍያ ዋጋ ትክክል አይደለም።' };
  return { ok: true };
}

// ─── Main validator ────────────────────────────────────────────────────────────
export async function validateTelebirrSms(
  smsText: string,
  expectedAmount: number,
  receiverPhone: string
): Promise<ValidationResult> {

  const data = parseTelebirrSms(smsText);
  if (!data) {
    return {
      valid: false,
      error: '❌ SMS ሊነበብ አልቻለም። ሙሉ SMS ኮፒ አድርገው ይለጥፉ። (English / Amharic / Afaan Oromo)',
    };
  }

  // ── Bot self-verifies its own parsed output before trusting it ──────────────
  const selfCheck = selfVerifyParsed(data);
  if (!selfCheck.ok) {
    logger.warn(`[BunaFrankValidator] Self-verify failed for SMS: ${selfCheck.issue}`);
    return { valid: false, error: selfCheck.issue };
  }

  // ── Load authorized deposit accounts for this user ─────────────────────────
  // Default fallback — MUST stay in sync with depositFlow.ts DEFAULT_DEPOSIT_ACCOUNTS
  const DEFAULT_ACCOUNTS = [
    { name: 'LUEL G/Libanos', phone: '251969455111', last4: '5111', keywords: ['luel', 'libanos', 'g/libanos'] },
  ];

  let authorizedAccounts = DEFAULT_ACCOUNTS;

  try {
    // Find the user's agent ancestor (ignoring regular player referrers)
    const userRecord = await prisma.user.findFirst({
      where: { telegramId: BigInt(receiverPhone) }
    });

    let agentPhones: any[] = [];
    const isAgentOrAdmin = userRecord?.role === 'AGENT' || userRecord?.role === 'ADMIN' || userRecord?.role === 'admin';
    
    if (userRecord && !isAgentOrAdmin) {
      const agent = await findAgentAncestor(userRecord.id);
      if (agent) {
        const refPhones = agent.depositPhones as any[];
        if (refPhones && refPhones.length > 0) {
          agentPhones = refPhones;
        } else if (agent.phone || agent.phoneNumber) {
          const phone = agent.phone || agent.phoneNumber;
          if (phone) {
            agentPhones = [{
              name: agent.firstName || agent.telegramUsername || 'Agent',
              phone: phone,
              last4: phone.slice(-4)
            }];
          }
        }
      }
    }

    if (agentPhones.length === 0) {
      // Fallback to master admin — same lookup as depositFlow.ts
      const defaultAgent = await prisma.user.findFirst({
        where: { telegramId: BigInt('6836036070') }
      });
      if (defaultAgent?.depositPhones) {
        agentPhones = defaultAgent.depositPhones as any[];
      } else if (defaultAgent && (defaultAgent.phone || defaultAgent.phoneNumber)) {
        const phone = defaultAgent.phone || defaultAgent.phoneNumber!;
        agentPhones = [{ name: defaultAgent.firstName || 'LUEL G/Libanos', phone, last4: phone.slice(-4) }];
      }
    }

    if (agentPhones.length > 0) {
      authorizedAccounts = agentPhones.map(p => ({
        name: p.name,
        phone: p.phone.startsWith('0') ? '251' + p.phone.slice(1) : p.phone,
        last4: p.last4 || p.phone.slice(-4),
        keywords: p.name.toLowerCase().split(/\s+/)
      }));
      
      // Always allow depositing directly to the master account
      const masterAcc = DEFAULT_ACCOUNTS[0];
      if (!authorizedAccounts.some(a => a.last4 === masterAcc.last4)) {
        authorizedAccounts.push(masterAcc);
      }
    }
  } catch (dbErr) {
    logger.warn('[BunaFrankValidator] DB lookup failed, using default accounts:', dbErr);
  }

  // ── Find which account the SMS was sent to ──────────────────────────────────
  // Oromo SMS may only show 2 trailing digits — use endsWith for flexible matching
  const matchedAccount = authorizedAccounts.find(a =>
    a.last4 === data.recipientPhoneLast4 || a.last4.endsWith(data.recipientPhoneLast4)
  );

  if (!matchedAccount) {
    const allowedLast4s = authorizedAccounts.map(a => `...${a.last4}`).join(', ');
    return {
      valid: false,
      error: `❌ Wrong recipient number. Expected last 4 to match one of: ${allowedLast4s}.`,
    };
  }

  // ── Strict name+phone pairing: recipient name must match the account ────────
  const normRecipient = data.recipientName.toLowerCase();
  const nameMatches = matchedAccount.keywords.some((kw: string) => normRecipient.includes(kw));

  if (!nameMatches) {
    return {
      valid: false,
      error: `❌ Recipient mismatch. Phone (...${matchedAccount.last4}) must belong to ${matchedAccount.name}. Found: ${data.recipientName}`,
    };
  }

  const diff = Math.abs(data.amount - expectedAmount);
  if (diff > 5) {
    return {
      valid: false,
      error: `❌ Amount mismatch. Expected ${expectedAmount.toFixed(2)}, found ${data.amount.toFixed(2)}`,
    };
  }

  const duplicate = await prisma.deposit.findFirst({
    where: { txnId: { contains: data.transactionId } },
  });
  if (duplicate) {
    return {
      valid: false,
      error: `❌ Transaction \`${data.transactionId}\` already used.`,
    };
  }

  // ─── Time Expiry Check (3 Hours) ───
  if (data.dateTime) {
    try {
      // Expected format: "DD/MM/YYYY HH:mm:ss" or "DD-MM-YYYY HH:mm:ss"
      const [datePart, timePart] = data.dateTime.split(' ');
      const [d, m, y] = datePart.replace(/-/g, '/').split('/').map(Number);
      const [hh, mm, ss] = timePart.split(':').map(Number);
      
      const receiptDate = new Date(y, m - 1, d, hh, mm, ss);
      const now = new Date();
      const diffMs = now.getTime() - receiptDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours > 3) {
        logger.warn(`[BunaFrankValidator] Receipt expired: ${data.transactionId} (Age: ${diffHours.toFixed(1)}h)`);
        return {
          valid: false,
          error: `❌ Receipt expired. Transactions must be verified within 3 hours. (Found: ${data.dateTime})`,
        };
      }
    } catch (err) {
      logger.warn('[BunaFrankValidator] Could not parse receipt date for expiry check');
    }
  }

  const onlineVerified = await verifyReceiptOnline(data.receiptUrl, data.transactionId);

  return { valid: true, data, onlineVerified };
}

// ─── Local-only validator — all 7 security checks, NO external HTTP call ────────
// Use this for instant UX. Then call verifyReceiptOnline() separately in background.
export async function validateTelebirrSmsLocal(
  smsText: string,
  expectedAmount: number,
  receiverPhone: string
): Promise<ValidationResult> {

  // 1. Parse SMS
  const data = parseTelebirrSms(smsText);
  if (!data) {
    return {
      valid: false,
      error: '❌ SMS ሊነበብ አልቻለም። ሙሉ SMS ኮፒ አድርገው ይለጥፉ። (Supports: English / Amharic / Afaan Oromo)',
    };
  }

  // 2. Self-verify parsed fields
  const selfCheck = selfVerifyParsed(data);
  if (!selfCheck.ok) {
    logger.warn(`[BunaFrankValidator] Self-verify failed: ${selfCheck.issue}`);
    return { valid: false, error: selfCheck.issue };
  }

  // Default fallback — MUST stay in sync with depositFlow.ts DEFAULT_DEPOSIT_ACCOUNTS
  const DEFAULT_ACCOUNTS = [
    { name: 'LUEL G/Libanos', phone: '251969455111', last4: '5111', keywords: ['luel', 'libanos', 'g/libanos'] },
  ];
  let authorizedAccounts = DEFAULT_ACCOUNTS;
  try {
    const userRecord = await prisma.user.findFirst({
      where: { telegramId: BigInt(receiverPhone) }
    });
    
    let agentPhones: any[] = [];
    const isAgentOrAdmin = userRecord?.role === 'AGENT' || userRecord?.role === 'ADMIN' || userRecord?.role === 'admin';
    
    if (userRecord && !isAgentOrAdmin) {
      const agent = await findAgentAncestor(userRecord.id);
      if (agent) {
        const refPhones = agent.depositPhones as any[];
        if (refPhones && refPhones.length > 0) {
          agentPhones = refPhones;
        } else if (agent.phone || agent.phoneNumber) {
          const phone = agent.phone || agent.phoneNumber;
          if (phone) {
            agentPhones = [{
              name: agent.firstName || agent.telegramUsername || 'Agent',
              phone: phone,
              last4: phone.slice(-4)
            }];
          }
        }
      }
    }

    if (agentPhones.length === 0) {
      // Fallback to master admin — same lookup as depositFlow.ts
      const defaultAgent = await prisma.user.findFirst({ where: { telegramId: BigInt('6836036070') } });
      if (defaultAgent?.depositPhones) {
        agentPhones = defaultAgent.depositPhones as any[];
      } else if (defaultAgent && (defaultAgent.phone || defaultAgent.phoneNumber)) {
        const phone = defaultAgent.phone || defaultAgent.phoneNumber!;
        agentPhones = [{ name: defaultAgent.firstName || 'LUEL G/Libanos', phone, last4: phone.slice(-4) }];
      }
    }
    if (agentPhones.length > 0) {
      authorizedAccounts = agentPhones.map(p => ({
        name: p.name,
        phone: p.phone.startsWith('0') ? '251' + p.phone.slice(1) : p.phone,
        last4: p.last4 || p.phone.slice(-4),
        keywords: p.name.toLowerCase().split(/\s+/)
      }));
      
      // Always allow depositing directly to the master account
      const masterAcc = DEFAULT_ACCOUNTS[0];
      if (!authorizedAccounts.some(a => a.last4 === masterAcc.last4)) {
        authorizedAccounts.push(masterAcc);
      }
    }
  } catch (dbErr) {
    logger.warn('[BunaFrankValidator] DB lookup failed, using default accounts:', dbErr);
  }

  // 4. Recipient phone must match an authorized account
  // Oromo SMS may only show 2 trailing digits — use endsWith for flexible matching
  const matchedAccount = authorizedAccounts.find(a =>
    a.last4 === data.recipientPhoneLast4 || a.last4.endsWith(data.recipientPhoneLast4)
  );
  if (!matchedAccount) {
    const allowedLast4s = authorizedAccounts.map(a => `...${a.last4}`).join(', ');
    return { valid: false, error: `❌ Wrong recipient number. Expected last 4 to match one of: ${allowedLast4s}.` };
  }

  // 5. Recipient name must match account keywords
  const normRecipient = data.recipientName.toLowerCase();
  const nameMatches = matchedAccount.keywords.some((kw: string) => normRecipient.includes(kw));
  if (!nameMatches) {
    return { valid: false, error: `❌ Recipient mismatch. Phone (...${matchedAccount.last4}) must belong to ${matchedAccount.name}. Found: ${data.recipientName}` };
  }

  // 6. Amount must match (within 5 ETB tolerance)
  const diff = Math.abs(data.amount - expectedAmount);
  if (diff > 5) {
    return { valid: false, error: `❌ Amount mismatch. Expected ${expectedAmount.toFixed(2)}, found ${data.amount.toFixed(2)}` };
  }

  // 7. Duplicate transaction guard
  const duplicate = await prisma.deposit.findFirst({ where: { txnId: { contains: data.transactionId } } });
  if (duplicate) {
    return { valid: false, error: `❌ Transaction \`${data.transactionId}\` already used.` };
  }

  // 8. Time expiry check (3 hours)
  if (data.dateTime) {
    try {
      const [datePart, timePart] = data.dateTime.split(' ');
      const [d, m, y] = datePart.replace(/-/g, '/').split('/').map(Number);
      const [hh, mm, ss] = timePart.split(':').map(Number);
      const receiptDate = new Date(y, m - 1, d, hh, mm, ss);
      const diffHours = (Date.now() - receiptDate.getTime()) / (1000 * 60 * 60);
      if (diffHours > 3) {
        logger.warn(`[BunaFrankValidator] Receipt expired: ${data.transactionId} (Age: ${diffHours.toFixed(1)}h)`);
        return { valid: false, error: `❌ Receipt expired. Transactions must be verified within 3 hours. (Found: ${data.dateTime})` };
      }
    } catch (err) {
      logger.warn('[BunaFrankValidator] Could not parse receipt date for expiry check');
    }
  }

  // All local checks passed — online verification will run in background
  return { valid: true, data, onlineVerified: false };
}
