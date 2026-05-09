"use strict";
/**
 * BunaFrank SMS & Receipt Validator
 *
 * Parses the standard Telebirr SMS format:
 * "Dear TAMIRAT You have transferred ETB 15.00 to Yohanis Ashenafi (2519****8294)
 *  on 08/05/2026 17:20:46. Your transaction number is DE84OPTF9M. ..."
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTelebirrSms = parseTelebirrSms;
exports.validateReceiptImage = validateReceiptImage;
exports.validateTelebirrSms = validateTelebirrSms;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../lib/logger");
const prisma_1 = __importDefault(require("../lib/prisma"));
const config_1 = require("../config");
// ─── Parser ────────────────────────────────────────────────────────────────────
function parseTelebirrSms(smsText) {
    try {
        const text = smsText.replace(/\s+/g, ' ').trim();
        const senderMatch = text.match(/Dear\s+([A-Za-z\s]+?)[\s\n,]/i);
        const senderName = senderMatch?.[1]?.trim() ?? 'Unknown';
        const amountMatch = text.match(/transferred\s+ETB\s+([\d,]+\.?\d*)\s+to/i);
        if (!amountMatch)
            return null;
        const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
        const recipientMatch = text.match(/to\s+([A-Za-z\s]+?)\s+\((25\d{2}[\*x]+(\d{4}))\)/i);
        if (!recipientMatch)
            return null;
        const recipientName = recipientMatch[1].trim();
        const recipientPhoneMasked = recipientMatch[2];
        const recipientPhoneLast4 = recipientMatch[3];
        const dateMatch = text.match(/on\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i);
        const dateTime = dateMatch?.[1] ?? '';
        const txnMatch = text.match(/transaction number is\s+([A-Z0-9]+)/i);
        if (!txnMatch)
            return null;
        const transactionId = txnMatch[1].trim();
        const feeMatch = text.match(/service fee is\s+ETB\s+([\d.]+)/i);
        const serviceFee = feeMatch ? parseFloat(feeMatch[1]) : 0;
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
    }
    catch (err) {
        logger_1.logger.error('[BunaFrankValidator] Parse error:', err);
        return null;
    }
}
// ─── Online receipt verification ───────────────────────────────────────────────
async function verifyReceiptOnline(receiptUrl, transactionId) {
    try {
        if (config_1.config.payment.bunaEngineHost) {
            const scraperUrl = `${config_1.config.payment.bunaEngineHost.replace(/\/$/, '')}/validate/${transactionId}`;
            const res = await axios_1.default.get(scraperUrl, {
                timeout: 10000,
                headers: { 'x-api-key': config_1.config.payment.bunaEngineKey }
            });
            if (res.data?.success && res.data?.data?.transactionId === transactionId) {
                logger_1.logger.info(`[BunaFrankValidator] ✅ Verified via engine: ${transactionId}`);
                return true;
            }
        }
        const res = await axios_1.default.get(receiptUrl, {
            timeout: 8000,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BotValidator/1.0)' },
        });
        const html = String(res.data);
        const found = html.includes(transactionId);
        if (found) {
            logger_1.logger.info(`[BunaFrankValidator] ✅ Verified online: ${transactionId}`);
        }
        else {
            logger_1.logger.warn(`[BunaFrankValidator] ⚠️ Not found: ${transactionId}`);
        }
        return found;
    }
    catch (err) {
        logger_1.logger.warn(`[BunaFrankValidator] Online check failed: ${err.message}`);
        return false;
    }
}
/**
 * Validates a receipt image via the Scraper Engine's OCR
 */
async function validateReceiptImage(fileUrl, expectedAmount) {
    try {
        if (!config_1.config.payment.bunaEngineHost) {
            return { valid: false, error: 'Scraper engine not configured' };
        }
        const scraperUrl = `${config_1.config.payment.bunaEngineHost.replace(/\/$/, '')}/validate-image`;
        const res = await axios_1.default.post(scraperUrl, { imageUrl: fileUrl }, {
            timeout: 30000, // OCR can be slow
            headers: { 'x-api-key': config_1.config.payment.bunaEngineKey }
        });
        if (!res.data?.success) {
            return { valid: false, error: 'Failed to process image' };
        }
        const { transactionId, amount } = res.data.extracted;
        if (!transactionId) {
            return { valid: false, error: 'Could not find a transaction ID in the image.' };
        }
        // Check for duplicate transaction ID
        const duplicate = await prisma_1.default.deposit.findFirst({
            where: { reference: { contains: transactionId } },
        });
        if (duplicate) {
            return { valid: false, error: `Transaction ${transactionId} has already been used.` };
        }
        // Amount validation (if found by OCR)
        if (amount) {
            const parsedAmount = parseFloat(amount);
            const diff = Math.abs(parsedAmount - expectedAmount);
            if (diff > 5) {
                return {
                    valid: false,
                    error: `Amount mismatch! Image says ${parsedAmount}, you claimed ${expectedAmount}.`
                };
            }
        }
        // Now verify the extracted ID online
        const onlineVerified = await verifyReceiptOnline('', transactionId);
        if (!onlineVerified) {
            return { valid: false, error: 'Transaction ID found but could not be verified on Telebirr website.' };
        }
        return {
            valid: true,
            onlineVerified: true,
            isOcr: true,
            data: {
                transactionId,
                amount: amount ? parseFloat(amount) : expectedAmount,
            }
        };
    }
    catch (err) {
        logger_1.logger.error(`[BunaFrankValidator] OCR Validation error: ${err.message}`);
        return { valid: false, error: 'OCR validation service is currently unavailable.' };
    }
}
// ─── Main validator ────────────────────────────────────────────────────────────
async function validateTelebirrSms(smsText, expectedAmount, receiverPhone) {
    const data = parseTelebirrSms(smsText);
    if (!data) {
        return {
            valid: false,
            error: '❌ Could not read your SMS. Please paste the *exact* receipt starting with "Dear..."',
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
    const duplicate = await prisma_1.default.deposit.findFirst({
        where: { reference: { contains: data.transactionId } },
    });
    if (duplicate) {
        return {
            valid: false,
            error: `❌ Transaction \`${data.transactionId}\` already used.`,
        };
    }
    const onlineVerified = await verifyReceiptOnline(data.receiptUrl, data.transactionId);
    return { valid: true, data, onlineVerified };
}
//# sourceMappingURL=bunafrankValidator.js.map