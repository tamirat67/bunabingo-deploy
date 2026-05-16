/**
 * BunaFrank SMS & Receipt Validator
 *
 * Parses the standard Telebirr SMS format:
 * "Dear TAMIRAT You have transferred ETB 15.00 to Yohanis Ashenafi (2519****8294)
 *  on 08/05/2026 17:20:46. Your transaction number is DE84OPTF9M. ..."
 */

import axios from 'axios';
import { logger } from '../lib/logger';
import prisma from '../lib/prisma';
import { config } from '../config';

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

    // 1. Transaction ID
    // English: Your transaction number is DE84OPTF9M.
    // Amharic: የሂሳብ እንቅስቃሴ ቁጥርዎ DEB5T78F8X ነዉ።
    const txnMatch = text.match(/(?:transaction number is|ቁጥርዎ)\s+([A-Z0-9]{6,})/i);
    if (!txnMatch) return null;
    const transactionId = txnMatch[1].trim();

    // 2. Recipient & Amount
    let recipientName = 'Unknown';
    let recipientPhoneMasked = '';
    let recipientPhoneLast4 = '';
    let amount = 0;

    // Try English Pattern first
    // "... transferred ETB 15.00 to Yohanis Ashenafi (2519****8294)"
    const enPattern = /transferred\s+ETB\s+([\d,]+\.?\d*)\s+to\s+([^(]+?)\s*\((25\d{2}[\*x]+(\d{4}))\)/i;
    const enMatch = text.match(enPattern);
    
    if (enMatch) {
      amount = parseFloat(enMatch[1].replace(/,/g, ''));
      recipientName = enMatch[2].trim();
      recipientPhoneMasked = enMatch[3];
      recipientPhoneLast4 = enMatch[4];
    } else {
      // Try Amharic Pattern
      // "ወደ Yohanis Ashenafi(2519****8294) 10.00 ብር"
      const amPattern = /ወደ\s+([^(]+?)\s*\((25\d{2}[\*x]+(\d{4}))\)\s+([\d,]+\.?\d*)\s+ብር/i;
      const amMatch = text.match(amPattern);
      if (amMatch) {
        recipientName = amMatch[1].trim();
        recipientPhoneMasked = amMatch[2];
        recipientPhoneLast4 = amMatch[3];
        amount = parseFloat(amMatch[4].replace(/,/g, ''));
      }
    }

    if (amount === 0 || !recipientPhoneMasked) return null;

    // 3. DateTime
    // English: "on 08/05/2026 17:20:46"
    // Amharic: "በ 11/05/2026 21:49:35"
    const dateMatch = text.match(/(?:on|በ)\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i);
    const dateTime = dateMatch?.[1] ?? '';

    // 4. Sender
    // English: "Dear NAME"
    // Amharic: "ውድNAME"
    const senderMatch = text.match(/(?:Dear|ውድ)\s*([^\s\n,]+)/i);
    const senderName = senderMatch?.[1]?.trim() ?? 'Unknown';

    // 5. Service Fee
    const feeMatch = text.match(/(?:service fee is ETB|የአገልግሎት ክፍያው)\s+([\d.]+)/i);
    const serviceFee = feeMatch ? parseFloat(feeMatch[1]) : 0;

    // 6. URL
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
  const maxRetries = 3;
  const retryDelay = 5000; // 5 seconds

  for (let i = 0; i < maxRetries; i++) {
    try {
      if (i > 0) {
        logger.info(`[BunaFrankValidator] Retry ${i}/${maxRetries} for ${transactionId}...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

      if (config.payment.bunaEngineHost) {
        try {
          const scraperUrl = `${config.payment.bunaEngineHost.replace(/\/$/, '')}/validate/${transactionId}`;
          const altScraperUrl = `${config.payment.bunaEngineHost.replace(/\/$/, '')}/?txnId=${transactionId}`;
          
          logger.info(`[BunaFrankValidator] Calling scraper: ${scraperUrl}`);
          
          let res = await axios.get(scraperUrl, { 
            timeout: 10000,
            headers: { 'x-api-key': config.payment.bunaEngineKey },
          }).catch(() => null);

          if (!res || !res.data) {
            logger.info(`[BunaFrankValidator] Primary scraper failed, trying alt: ${altScraperUrl}`);
            res = await axios.get(altScraperUrl, { timeout: 10000 }).catch(() => null);
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
          timeout: 10000,
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
      error: '❌ Could not read your SMS. Please paste the *exact* receipt starting with "Dear..." or "ውድ..."',
    };
  }

  const ourLast4 = receiverPhone.replace(/^0/, '').slice(-4);
  if (data.recipientPhoneLast4 !== ourLast4) {
    return {
      valid: false,
      error: `❌ Wrong recipient number. Expected last 4: ...${ourLast4}`,
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
      // Expected format: "DD/MM/YYYY HH:mm:ss"
      const [datePart, timePart] = data.dateTime.split(' ');
      const [d, m, y] = datePart.split('/').map(Number);
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
