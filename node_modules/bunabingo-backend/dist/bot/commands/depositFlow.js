"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDepositManualStart = handleDepositManualStart;
exports.handleDepositCancel = handleDepositCancel;
exports.handleDepositSubmit = handleDepositSubmit;
exports.handleDepositMessage = handleDepositMessage;
exports.handlePayCbeBirr = handlePayCbeBirr;
exports.handlePayCbeBank = handlePayCbeBank;
exports.handlePayMpesa = handlePayMpesa;
exports.handlePayTelebirr = handlePayTelebirr;
const telegraf_1 = require("telegraf");
const user_service_1 = require("../../services/user.service");
const session_1 = require("../session");
const config_1 = require("../../config");
const prisma_1 = __importDefault(require("../../lib/prisma"));
const logger_1 = require("../../lib/logger");
// ─── Helpers ───────────────────────────────────────────────────────────────────
function generateReference(length = 10) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
const CANCEL_BTN = [[telegraf_1.Markup.button.callback('❌ Cancel', 'cmd_deposit_cancel')]];
// ─── Step 1: Ask for amount ────────────────────────────────────────────────────
async function handleDepositManualStart(ctx) {
    if (ctx.callbackQuery)
        await ctx.answerCbQuery();
    const tgUser = ctx.from;
    const user = await (0, user_service_1.getUserByTelegramId)(tgUser.id);
    if (!user)
        return ctx.reply('❌ Please /start first to register.');
    (0, session_1.setSession)(tgUser.id, { type: 'MANUAL_DEPOSIT', step: 'AWAITING_AMOUNT' });
    await ctx.reply(`💳 *Manual Deposit*\n\n` +
        `እንዲሞላልዎት የሚፈልጉትን የገንዘብ መጠን ያስገቡ:\n` +
        `_(Enter the amount you want to deposit in ETB)_\n\n` +
        `_Minimum: 10 ETB_`, {
        parse_mode: 'Markdown',
        ...telegraf_1.Markup.inlineKeyboard(CANCEL_BTN),
    });
}
// ─── Cancel ────────────────────────────────────────────────────────────────────
async function handleDepositCancel(ctx) {
    if (ctx.callbackQuery)
        await ctx.answerCbQuery();
    (0, session_1.clearSession)(ctx.from.id);
    await ctx.reply('❌ Deposit cancelled.');
}
// ─── Skip screenshot → submit ──────────────────────────────────────────────────
async function handleDepositSubmit(ctx) {
    if (ctx.callbackQuery)
        await ctx.answerCbQuery();
    const session = (0, session_1.getSession)(ctx.from.id);
    if (!session || session.type !== 'MANUAL_DEPOSIT')
        return;
    await submitDeposit(ctx, session.amount, session.reference, undefined, session.paymentMethod);
}
// ─── Main message router ───────────────────────────────────────────────────────
async function handleDepositMessage(ctx) {
    const tgUser = ctx.from;
    const session = (0, session_1.getSession)(tgUser.id);
    if (!session || session.type !== 'MANUAL_DEPOSIT')
        return false;
    const msg = ctx.message; // Cast to any to handle both text and photo properties safely
    // ── AWAITING_AMOUNT ────────────────────────────────────────────────────────
    if (session.step === 'AWAITING_AMOUNT') {
        const raw = msg?.text?.trim();
        const amount = parseFloat(raw);
        if (!raw || isNaN(amount) || amount < 10) {
            await ctx.reply(`⚠️ Invalid amount. Please enter a number ≥ 10 ETB.\n\nእባክዎ ትክክለኛ የገንዘብ መጠን ያስገቡ:`, { parse_mode: 'Markdown', ...telegraf_1.Markup.inlineKeyboard(CANCEL_BTN) });
            return true;
        }
        const reference = generateReference();
        (0, session_1.setSession)(tgUser.id, {
            type: 'MANUAL_DEPOSIT',
            step: 'AWAITING_SCREENSHOT',
            amount,
            reference,
        });
        const { receiverName, receiverPhone } = config_1.config.payment;
        await ctx.reply(`Payment details`, { parse_mode: 'Markdown' });
        await ctx.reply(`\`\`\`\nName:      ${receiverName}\nPhone:     ${receiverPhone}\nAmount:    ${amount}ETB\nreference: ${reference}\n\`\`\``, {
            parse_mode: 'Markdown',
            ...telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback('Pay from  CBE-Birr to MPESA', 'cmd_pay_cbe_birr')],
                [telegraf_1.Markup.button.callback('Pay from  CBEBANK to MPESA', 'cmd_pay_cbe_bank')],
                [telegraf_1.Markup.button.callback('Pay from  MPESA to MPESA only', 'cmd_pay_mpesa')],
                [telegraf_1.Markup.button.callback('Pay from  telebirr to telebirr only', 'cmd_pay_telebirr')],
                [telegraf_1.Markup.button.callback('❌ Cancel', 'cmd_deposit_cancel')],
            ]),
        });
        return true;
    }
    // ── AWAITING_SCREENSHOT (CBE/MPESA) ───────────────────────────────────────
    if (session.step === 'AWAITING_SCREENSHOT') {
        const photoMsg = msg;
        if (!photoMsg.photo?.length) {
            await ctx.reply(`📸 Please send your payment *screenshot*, or click Skip.\n_(ያለዎትን ደረሰኝ ፎቶ ይላኩ)_`, {
                parse_mode: 'Markdown',
                ...telegraf_1.Markup.inlineKeyboard([
                    [telegraf_1.Markup.button.callback('⏭ Skip Screenshot', 'cmd_deposit_submit')],
                    [telegraf_1.Markup.button.callback('❌ Cancel', 'cmd_deposit_cancel')],
                ]),
            });
            return true;
        }
        const fileId = photoMsg.photo[photoMsg.photo.length - 1].file_id;
        // --- Automatic OCR Validation for Photos ---
        await ctx.reply('🔍 Scanning receipt for automatic approval...');
        const file = await ctx.telegram.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${config_1.config.bot.token}/${file.file_path}`;
        const { validateReceiptImage } = await Promise.resolve().then(() => __importStar(require('../../services/bunafrankValidator')));
        const result = await validateReceiptImage(fileUrl, session.amount);
        if (result.valid) {
            const d = result.data;
            await ctx.reply(`✅ *Automatic Verification Successful!*\nTransaction ID: \`${d.transactionId}\`\nAmount: \`${d.amount} ETB\``, { parse_mode: 'Markdown' });
            await submitDeposit(ctx, session.amount, d.transactionId, fileId, session.paymentMethod, true);
        }
        else {
            await ctx.reply(`⚠️ *Manual Review Required*\nReason: ${result.error}\n\nSubmitting for admin review...`, { parse_mode: 'Markdown' });
            await submitDeposit(ctx, session.amount, session.reference, fileId, session.paymentMethod, false, result.error);
        }
        return true;
    }
    // ── AWAITING_SMS (Telebirr) ────────────────────────────────────────────────
    if (session.step === 'AWAITING_SMS') {
        const smsText = msg?.text?.trim();
        if (!smsText || smsText.length < 20) {
            await ctx.reply(`⚠️ Please paste the *full* Telebirr SMS you received.\n_(Starting with "Dear...")_`, { parse_mode: 'Markdown', ...telegraf_1.Markup.inlineKeyboard(CANCEL_BTN) });
            return true;
        }
        // ── Validate ──
        await ctx.reply(`🔍 Validating your Telebirr receipt...`);
        const { validateTelebirrSms, validateReceiptImage } = await Promise.resolve().then(() => __importStar(require('../../services/bunafrankValidator')));
        const result = await validateTelebirrSms(smsText, session.amount, config_1.config.payment.telebirrPhone);
        if (!result.valid) {
            await ctx.reply(result.error + `\n\nPlease try again or contact support.`, { parse_mode: 'Markdown', ...telegraf_1.Markup.inlineKeyboard(CANCEL_BTN) });
            return true;
        }
        // ── Valid — show parsed confirmation ──
        const d = result.data;
        const verifiedBadge = result.onlineVerified ? '✅ Verified online' : '⚠️ Pending manual review';
        await ctx.reply(`✅ *Receipt Validated!*\n\n` +
            `\`\`\`\n` +
            `Transaction ID : ${d.transactionId}\n` +
            `Amount         : ETB ${d.amount.toFixed(2)}\n` +
            `Recipient      : ${d.recipientName}\n` +
            `Phone          : ${d.recipientPhoneMasked}\n` +
            `Date/Time      : ${d.dateTime}\n` +
            `Service Fee    : ETB ${d.serviceFee.toFixed(2)}\n` +
            `\`\`\`\n` +
            `🔗 ${verifiedBadge}\n\n` +
            `Submitting your deposit...`, { parse_mode: 'Markdown' });
        // Use transaction ID as the reference (unique & verifiable)
        await submitDeposit(ctx, session.amount, d.transactionId, undefined, 'telebirr');
        return true;
    }
    return false;
}
// ─── Payment method: CBE-Birr ──────────────────────────────────────────────────
async function handlePayCbeBirr(ctx) {
    if (ctx.callbackQuery)
        await ctx.answerCbQuery();
    const session = (0, session_1.getSession)(ctx.from.id);
    if (!session || session.type !== 'MANUAL_DEPOSIT')
        return;
    (0, session_1.setSession)(ctx.from.id, { ...session, paymentMethod: 'cbe_birr', step: 'AWAITING_SCREENSHOT' });
    const { receiverPhone } = config_1.config.payment;
    await ctx.reply(`🏦 *CBE-Birr → MPESA*\n\n` +
        `\`\`\`\n` +
        `1. CBE-Birr አፕልኬሽን ይክፈቱ\n` +
        `2. ${session.amount} ብር ወደ ${receiverPhone} ይላኩ\n` +
        `3. ደረሰኝ (screenshot) ያስቀምጡ\n` +
        `4. ያስቀመጡትን ፎቶ ከዚ ላይ ይላኩ\n` +
        `\`\`\`\n\n` +
        `📸 Send your *payment screenshot* here 👇`, {
        parse_mode: 'Markdown',
        ...telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('⏭ Skip Screenshot', 'cmd_deposit_submit')],
            [telegraf_1.Markup.button.callback('❌ Cancel', 'cmd_deposit_cancel')],
        ]),
    });
}
// ─── Payment method: CBE Bank ──────────────────────────────────────────────────
async function handlePayCbeBank(ctx) {
    if (ctx.callbackQuery)
        await ctx.answerCbQuery();
    const session = (0, session_1.getSession)(ctx.from.id);
    if (!session || session.type !== 'MANUAL_DEPOSIT')
        return;
    (0, session_1.setSession)(ctx.from.id, { ...session, paymentMethod: 'cbe_bank', step: 'AWAITING_SCREENSHOT' });
    const { receiverPhone } = config_1.config.payment;
    await ctx.reply(`🏦 *CBE Bank → MPESA*\n\n` +
        `\`\`\`\n` +
        `1. CBEBirr ወይም ቅርብ ወደሆነ CBE ቅርንጫፍ ይሂዱ\n` +
        `2. ${session.amount} ብር ወደ ${receiverPhone} ያስተላልፉ\n` +
        `3. ደረሰኝ (screenshot) ያስቀምጡ\n` +
        `4. ያስቀመጡትን ፎቶ ከዚ ላይ ይላኩ\n` +
        `\`\`\`\n\n` +
        `📸 Send your *payment screenshot* here 👇`, {
        parse_mode: 'Markdown',
        ...telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('⏭ Skip Screenshot', 'cmd_deposit_submit')],
            [telegraf_1.Markup.button.callback('❌ Cancel', 'cmd_deposit_cancel')],
        ]),
    });
}
// ─── Payment method: MPESA ─────────────────────────────────────────────────────
async function handlePayMpesa(ctx) {
    if (ctx.callbackQuery)
        await ctx.answerCbQuery();
    const session = (0, session_1.getSession)(ctx.from.id);
    if (!session || session.type !== 'MANUAL_DEPOSIT')
        return;
    (0, session_1.setSession)(ctx.from.id, { ...session, paymentMethod: 'mpesa', step: 'AWAITING_SCREENSHOT' });
    const { receiverPhone } = config_1.config.payment;
    await ctx.reply(`📱 *MPESA → MPESA*\n\n` +
        `\`\`\`\n` +
        `1. MPESA አፕልኬሽን ይክፈቱ\n` +
        `2. ${session.amount} ብር ወደ ${receiverPhone} ይላኩ\n` +
        `3. ደረሰኝ (screenshot) ያስቀምጡ\n` +
        `4. ያስቀመጡትን ፎቶ ከዚ ላይ ይላኩ\n` +
        `\`\`\`\n\n` +
        `📸 Send your *payment screenshot* here 👇`, {
        parse_mode: 'Markdown',
        ...telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('⏭ Skip Screenshot', 'cmd_deposit_submit')],
            [telegraf_1.Markup.button.callback('❌ Cancel', 'cmd_deposit_cancel')],
        ]),
    });
}
// ─── Payment method: Telebirr ──────────────────────────────────────────────────
async function handlePayTelebirr(ctx) {
    if (ctx.callbackQuery)
        await ctx.answerCbQuery();
    const session = (0, session_1.getSession)(ctx.from.id);
    if (!session || session.type !== 'MANUAL_DEPOSIT')
        return;
    (0, session_1.setSession)(ctx.from.id, { ...session, paymentMethod: 'telebirr', step: 'AWAITING_SMS' });
    const { telebirrPhone, supportAgent1, supportAgent2 } = config_1.config.payment;
    await ctx.reply(`የቴሌብር አካውንት\n\n` +
        `\`${telebirrPhone}\`\n\n` +
        `\`\`\`\n` +
        `1. ቴሌብር ከ ${telebirrPhone} ላይ ${session.amount} ብር ይላኩ\n` +
        `2. ከቴሌብር ያገኙትን SMS ይጠብቁ\n` +
        `3. SMS ሲደርስዎ ያንኑ ያስቀምጡ (copy)\n` +
        `4. ያስቀመጡትን (sms) ጽሁፍ ከ(copy) አድርጉ ከዚ ላይ ይለጥፉ(paste)\n` +
        `\`\`\`\n\n` +
        `የሚያጋጥማቹ የክፍያ ችግር ካለ ${supportAgent1} በዚ ኤጀንትን ማዋራት ይችላሉ ወይም ${supportAgent2} በዚ ሳፖርት ማዉራት ይችላሉ\n\n` +
        `የከፈለችሁበትን አጭር የጹሁፍ መለክት(sms) እዚ ላይ ያስገቡት 👇👇👇`, {
        parse_mode: 'Markdown',
        ...telegraf_1.Markup.inlineKeyboard(CANCEL_BTN),
    });
}
// ─── Final submission ──────────────────────────────────────────────────────────
async function submitDeposit(ctx, amount, referenceOrSms, screenshotFileId, paymentMethod, autoApprove = false, ocrFailureReason) {
    const tgUser = ctx.from;
    (0, session_1.clearSession)(tgUser.id);
    try {
        const user = await (0, user_service_1.getUserByTelegramId)(tgUser.id);
        if (!user)
            return ctx.reply('❌ User not found. Please /start first.');
        const deposit = await prisma_1.default.deposit.create({
            data: {
                userId: user.id,
                amount,
                reference: referenceOrSms,
                receiptUrl: screenshotFileId ?? null,
                status: 'PENDING',
            },
        });
        logger_1.logger.info(`[Deposit] ${deposit.id} — ${amount} ETB — method: ${paymentMethod ?? 'unknown'}`);
        const methodLabel = paymentMethod === 'telebirr' ? 'Telebirr' :
            paymentMethod === 'cbe_birr' ? 'CBE-Birr' :
                paymentMethod === 'cbe_bank' ? 'CBE Bank' :
                    paymentMethod === 'mpesa' ? 'MPESA' : 'Manual';
        const isTelebirr = paymentMethod === 'telebirr' || (referenceOrSms && /^[A-Z0-9]{10}$/.test(referenceOrSms));
        const receiptUrl = isTelebirr ? `https://transactioninfo.ethiotelecom.et/receipt/${referenceOrSms}` : null;
        await ctx.reply(`✅ *Deposit Submitted Successfully!*\n\n` +
            `💵 Amount: *${amount.toFixed(2)} ETB*\n` +
            `💳 Method: *${methodLabel}*\n` +
            `📋 Status: *${autoApprove ? '✅ Approved' : 'Pending Review'}*\n\n` +
            (autoApprove
                ? `Your balance has been updated! ☕`
                : `⏱ Your deposit will be reviewed within *30 minutes*.\nYou will be notified once approved. 🙏`), { parse_mode: 'Markdown' });
        if (autoApprove) {
            const { approveDeposit } = await Promise.resolve().then(() => __importStar(require('../../services/deposit.service')));
            const systemAdminId = config_1.config.bot.adminIds[0] || 'SYSTEM';
            try {
                await approveDeposit(deposit.id, systemAdminId);
                logger_1.logger.info(`[Deposit] Auto-approved ${deposit.id}`);
            }
            catch (err) {
                logger_1.logger.error(`[Deposit] Auto-approve failed for ${deposit.id}:`, err);
            }
            return; // No need to notify admins for manual approval if already done
        }
        // Notify admins
        const userName = tgUser.username ? `@${tgUser.username}` : user.firstName;
        const isSms = paymentMethod === 'telebirr';
        const adminCaption = `📥 *New Manual Deposit — ${methodLabel}*\n\n` +
            `👤 User: ${userName}\n` +
            `💵 Amount: *${amount.toFixed(2)} ETB*\n` +
            (ocrFailureReason ? `⚠️ *OCR FAIL:* \`${ocrFailureReason}\`\n` : '') +
            (isSms
                ? `📱 SMS Receipt:\n\`\`\`\n${referenceOrSms}\n\`\`\``
                : `🔖 Reference: \`${referenceOrSms}\``) +
            (receiptUrl ? `\n🔗 [View Official Receipt](${receiptUrl})` : '') +
            `\n🆔 Deposit ID: \`${deposit.id}\``;
        const adminKeyboard = telegraf_1.Markup.inlineKeyboard([
            [
                telegraf_1.Markup.button.callback('✅ Approve', `approve_dep_${deposit.id}`),
                telegraf_1.Markup.button.callback('❌ Reject', `reject_dep_${deposit.id}`),
            ],
        ]);
        for (const adminIdStr of config_1.config.bot.adminIds) {
            try {
                const adminTgId = parseInt(adminIdStr, 10);
                if (screenshotFileId) {
                    await ctx.telegram.sendPhoto(adminTgId, screenshotFileId, {
                        caption: adminCaption,
                        parse_mode: 'Markdown',
                        ...adminKeyboard,
                    });
                }
                else {
                    await ctx.telegram.sendMessage(adminTgId, adminCaption, {
                        parse_mode: 'Markdown',
                        ...adminKeyboard,
                    });
                }
            }
            catch (e) {
                logger_1.logger.warn(`[Deposit] Could not notify admin ${adminIdStr}:`, e);
            }
        }
        // --- Optional: Notify Support Admin specifically for Manual Reviews ---
        if (!autoApprove && config_1.config.payment.supportAdminId) {
            try {
                const supportId = parseInt(config_1.config.payment.supportAdminId, 10);
                if (screenshotFileId) {
                    await ctx.telegram.sendPhoto(supportId, screenshotFileId, {
                        caption: `🚨 *Support Alert: Manual Review Needed*\n\n${adminCaption}`,
                        parse_mode: 'Markdown',
                        ...adminKeyboard,
                    });
                }
                else {
                    await ctx.telegram.sendMessage(supportId, `🚨 *Support Alert: Manual Review Needed*\n\n${adminCaption}`, {
                        parse_mode: 'Markdown',
                        ...adminKeyboard,
                    });
                }
            }
            catch (e) {
                logger_1.logger.warn(`[Deposit] Could not notify Support Admin:`, e);
            }
        }
    }
    catch (err) {
        logger_1.logger.error('[Deposit] Submit error:', err);
        await ctx.reply('❌ Something went wrong. Please try again or contact support.');
    }
}
//# sourceMappingURL=depositFlow.js.map