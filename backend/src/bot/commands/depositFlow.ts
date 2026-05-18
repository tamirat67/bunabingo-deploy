import { Context, Markup } from 'telegraf';
import { Message } from 'telegraf/types';
import { getUserByTelegramId } from '../../services/user.service';
import { setSession, getSession, clearSession, PaymentMethod } from '../session';
import { config } from '../../config';
import { getReceiverPhone, getReceiverName, getTelebirrPhone } from '../../services/settings.service';
import prisma from '../../lib/prisma';
import { logger } from '../../lib/logger';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function generateReference(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const CANCEL_BTN = [[Markup.button.callback('❌ ሰርዝ (Cancel)', 'cmd_deposit_cancel')]];

// ─── Step 1: Ask for amount ────────────────────────────────────────────────────
export async function handleDepositManualStart(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const tgUser = ctx.from!;
  const user = await getUserByTelegramId(tgUser.id);
  if (!user) return ctx.reply('❌ እባክዎ መጀመሪያ /start ይበሉ። (Please /start first.)');

  setSession(tgUser.id, { type: 'MANUAL_DEPOSIT', step: 'AWAITING_AMOUNT' });

  await ctx.reply(
    `💳 *Manual Deposit / ብር ማስገቢያ*\n\n` +
    `እንዲሞላልዎት የሚፈልጉትን የገንዘብ መጠን ያስገቡ:\n` +
    `_(Enter the amount you want to deposit in ETB)_\n\n` +
    `ዝቅተኛው መጠን (Minimum): 10 ETB`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(CANCEL_BTN),
    }
  );
}

// ─── Cancel ────────────────────────────────────────────────────────────────────
export async function handleDepositCancel(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  clearSession(ctx.from!.id);
  await ctx.reply('❌ ብር ማስገቢያው ተሰርዟል። (Deposit cancelled.)');
}

// ─── Skip screenshot → submit ──────────────────────────────────────────────────
export async function handleDepositSubmit(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const session = getSession(ctx.from!.id);
  if (!session || session.type !== 'MANUAL_DEPOSIT') return;
  await submitDeposit(ctx, session.amount!, session.reference!, undefined, session.paymentMethod);
}

// ─── Main message router ───────────────────────────────────────────────────────
export async function handleDepositMessage(ctx: Context): Promise<boolean> {
  const tgUser = ctx.from!;
  const session = getSession(tgUser.id);
  if (!session || session.type !== 'MANUAL_DEPOSIT') return false;

  const msg = ctx.message as any; // Cast to any to handle both text and photo properties safely

  // ── AWAITING_AMOUNT ────────────────────────────────────────────────────────
  if (session.step === 'AWAITING_AMOUNT') {
    const raw = (msg as Message.TextMessage)?.text?.trim();
    const amount = parseFloat(raw);

    if (!raw || isNaN(amount) || amount < 10) {
      await ctx.reply(
        `⚠️ የተሳሳተ መጠን። እባክዎ ከ 10 ብር በላይ ያስገቡ። (Invalid amount. Minimum: 10 ETB.)`,
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard(CANCEL_BTN) }
      );
      return true;
    }

    const reference = generateReference();
    setSession(tgUser.id, {
      type: 'MANUAL_DEPOSIT',
      step: 'AWAITING_SCREENSHOT',
      amount,
      reference,
    });

    const receiverName = await getReceiverName();
    const receiverPhone = await getReceiverPhone();

    await ctx.reply(`የክፍያ ዝርዝሮች (Payment details):`, { parse_mode: 'Markdown' });

    await ctx.reply(
      `\`\`\`\nስም (Name):      ${receiverName}\nስልክ (Phone):     ${receiverPhone}\nመጠን (Amount):    ${amount} ETB\nማጣቀሻ (Ref):      ${reference}\n\`\`\``,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('ከ CBE-Birr ወደ MPESA ይክፈሉ',         'cmd_pay_cbe_birr')],
          [Markup.button.callback('ከ CBE Bank ወደ MPESA ይክፈሉ',          'cmd_pay_cbe_bank')],
          [Markup.button.callback('ከ MPESA ወደ MPESA ይክፈሉ',       'cmd_pay_mpesa')],
          [Markup.button.callback('ከ Telebirr ወደ Telebirr ይክፈሉ', 'cmd_pay_telebirr')],
          [Markup.button.callback('❌ ሰርዝ (Cancel)', 'cmd_deposit_cancel')],
        ]),
      }
    );
    return true;
  }

  // ── AWAITING_SCREENSHOT (CBE/MPESA) ───────────────────────────────────────
  if (session.step === 'AWAITING_SCREENSHOT') {
    const photoMsg = msg as Message.PhotoMessage;
    if (!photoMsg.photo?.length) {
      await ctx.reply(
        `📸 እባክዎ የከፈሉበትን ደረሰኝ ፎቶ (screenshot) ይላኩ።\n(Please send your payment screenshot.)`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ ሰርዝ (Cancel)', 'cmd_deposit_cancel')],
          ]),
        }
      );
      return true;
    }
    const fileId = photoMsg.photo[photoMsg.photo.length - 1].file_id;
    await submitDeposit(ctx, session.amount!, session.reference!, fileId, session.paymentMethod);
    return true;
  }

  // ── AWAITING_SMS (Telebirr) ────────────────────────────────────────────────
  if (session.step === 'AWAITING_SMS') {
    const smsText = (msg as Message.TextMessage)?.text?.trim();
    if (!smsText || smsText.length < 20) {
      await ctx.reply(
        `⚠️ እባክዎ የቴሌብር አጭር መልዕክቱን (SMS) ሙሉ በሙሉ ኮፒ አድርገው ይለጥፉ።\n(Please paste the full Telebirr SMS.)`,
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard(CANCEL_BTN) }
      );
      return true;
    }

    // ── 1. Validate SMS Content ──
    await ctx.reply(`🔍 የቴሌብር ደረሰኝዎን እያረጋገጥን ነው... (Validating...)`);
    const { validateTelebirrSms } = await import('../../services/bunafrankValidator');
    const telebirrPhoneNum = await getTelebirrPhone();
    const result = await validateTelebirrSms(
      smsText,
      session.amount!,
      telebirrPhoneNum
    );

    if (!result.valid) {
      await ctx.reply(
        `❌ *ስህተት፡ ደረሰኙ ትክክል አይደለም! (Invalid Receipt)*\n\n` +
        (result.error || "ደረሰኙ ሊታወቅ አልቻለም።") + `\n\nእባክዎ ትክክለኛ የቴሌብር SMS ያስገቡ።`,
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard(CANCEL_BTN) }
      );
      return true;
    }

    // ── 2. Check for Duplicate Transaction ID ──
    const d = result.data!;
    const existing = await prisma.deposit.findUnique({
      where: { txnId: d.transactionId }
    });

    if (existing) {
      await ctx.reply(`❌ *ስህተት፡ ይህ ደረሰኝ ቀድሞ ጥቅም ላይ ውሏል! (Duplicate Receipt)*\n\nይህ የግብይት መለያ (\`${d.transactionId}\`) ቀድሞ ገቢ ሆኗል። እባክዎ አንድ ደረሰኝ ከአንድ ጊዜ በላይ አይላኩ።`, { parse_mode: 'Markdown' });
      return true;
    }

    // ── Valid — show parsed confirmation ──
    const verifiedBadge = result.onlineVerified 
      ? '✅ በቅጽበት ተረጋግጧል (INSTANTLY VERIFIED)' 
      : '🔗 አውቶማቲክ ማረጋገጫ እየተከናወነ ነው... (Verifying...)';

    await ctx.reply(
      `✅ *ደረሰኙ ተረጋግጧል! (Validated)*\n\n` +
      `\`\`\`\n` +
      `የግብይት መለያ (ID)  : ${d.transactionId}\n` +
      `መጠን (Amount)      : ETB ${d.amount.toFixed(2)}\n` +
      `ተቀባይ (Recipient)   : ${d.recipientName}\n` +
      `ስልክ (Phone)        : ${d.recipientPhoneMasked}\n` +
      `ቀን (Date)           : ${d.dateTime}\n` +
      `የአገልግሎት ክፍያ (Fee): ETB ${d.serviceFee.toFixed(2)}\n` +
      `\`\`\`\n` +
      ` ${verifiedBadge}\n\n` +
      `ገቢውን እያጠናቀቅን ነው... (Finalizing...)`,
      { parse_mode: 'Markdown' }
    );

    // ── AUTO-APPROVE only if verified by the scraper for security ──
    await submitDeposit(ctx, session.amount!, d.transactionId, undefined, 'telebirr', d, result.onlineVerified);
    return true;
  }

  return false;
}

// ─── Payment method: CBE-Birr ──────────────────────────────────────────────────
export async function handlePayCbeBirr(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const session = getSession(ctx.from!.id);
  if (!session || session.type !== 'MANUAL_DEPOSIT') return;

  setSession(ctx.from!.id, { ...session, paymentMethod: 'cbe_birr', step: 'AWAITING_SCREENSHOT' });
  const receiverPhone = await getReceiverPhone();

  await ctx.reply(
    `🏦 *CBE-Birr → MPESA*\n\n` +
    `\`\`\`\n` +
    `1. CBE-Birr አፕልኬሽን ይክፈቱ\n` +
    `2. ${session.amount} ብር ወደ ${receiverPhone} ይላኩ\n` +
    `3. ደረሰኝ (screenshot) ያስቀምጡ\n` +
    `4. ያስቀመጡትን ፎቶ ከዚ ላይ ይላኩ\n` +
    `\`\`\`\n\n` +
    `📸 Send your *payment screenshot* here 👇`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancel', 'cmd_deposit_cancel')],
      ]),
    }
  );
}

// ─── Payment method: CBE Bank ──────────────────────────────────────────────────
export async function handlePayCbeBank(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const session = getSession(ctx.from!.id);
  if (!session || session.type !== 'MANUAL_DEPOSIT') return;

  setSession(ctx.from!.id, { ...session, paymentMethod: 'cbe_bank', step: 'AWAITING_SCREENSHOT' });
  const receiverPhone = await getReceiverPhone();

  await ctx.reply(
    `🏦 *CBE Bank → MPESA*\n\n` +
    `\`\`\`\n` +
    `1. CBEBirr ወይም ቅርብ ወደሆነ CBE ቅርንጫፍ ይሂዱ\n` +
    `2. ${session.amount} ብር ወደ ${receiverPhone} ያስተላልፉ\n` +
    `3. ደረሰኝ (screenshot) ያስቀምጡ\n` +
    `4. ያስቀመጡትን ፎቶ ከዚ ላይ ይላኩ\n` +
    `\`\`\`\n\n` +
    `📸 Send your *payment screenshot* here 👇`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancel', 'cmd_deposit_cancel')],
      ]),
    }
  );
}

// ─── Payment method: MPESA ─────────────────────────────────────────────────────
export async function handlePayMpesa(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const session = getSession(ctx.from!.id);
  if (!session || session.type !== 'MANUAL_DEPOSIT') return;

  setSession(ctx.from!.id, { ...session, paymentMethod: 'mpesa', step: 'AWAITING_SCREENSHOT' });
  const receiverPhone = await getReceiverPhone();

  await ctx.reply(
    `📱 *MPESA → MPESA*\n\n` +
    `\`\`\`\n` +
    `1. MPESA አፕልኬሽን ይክፈቱ\n` +
    `2. ${session.amount} ብር ወደ ${receiverPhone} ይላኩ\n` +
    `3. ደረሰኝ (screenshot) ያስቀምጡ\n` +
    `4. ያስቀመጡትን ፎቶ ከዚ ላይ ይላኩ\n` +
    `\`\`\`\n\n` +
    `📸 Send your *payment screenshot* here 👇`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancel', 'cmd_deposit_cancel')],
      ]),
    }
  );
}

// ─── Payment method: Telebirr ──────────────────────────────────────────────────
export async function handlePayTelebirr(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const session = getSession(ctx.from!.id);
  if (!session || session.type !== 'MANUAL_DEPOSIT') return;

  setSession(ctx.from!.id, { ...session, paymentMethod: 'telebirr', step: 'AWAITING_SMS' });

  const telebirrPhone = await getTelebirrPhone();
  const { supportAgent1, supportAgent2 } = config.payment;

  await ctx.reply(
    `የቴሌብር አካውንት\n\n` +
    `\`${telebirrPhone}\`\n\n` +
    `\`\`\`\n` +
    `1. ቴሌብር ከ ${telebirrPhone} ላይ ${session.amount} ብር ይላኩ\n` +
    `2. ከቴሌብር ያገኙትን SMS ይጠብቁ\n` +
    `3. SMS ሲደርስዎ ያንኑ ያስቀምጡ (copy)\n` +
    `4. ያስቀመጡትን (sms) ጽሁፍ ከ(copy) አድርጉ ከዚ ላይ ይለጥፉ(paste)\n` +
    `\`\`\`\n\n` +
    `የሚያጋጥማቹ የክፍያ ችግር ካለ ${supportAgent1} በዚ ኤጀንትን ማዋራት ይችላሉ ወይም ${supportAgent2} በዚ ሳፖርት ማዉራት ይችላሉ\n\n` +
    `የከፈለችሁበትን አጭር የጹሁፍ መለክት(sms) እዚ ላይ ያስገቡት 👇👇👇`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(CANCEL_BTN),
    }
  );
}

// ─── Final submission ──────────────────────────────────────────────────────────
async function submitDeposit(
  ctx: Context,
  amount: number,
  referenceOrSms: string,
  screenshotFileId: string | undefined,
  paymentMethod?: PaymentMethod,
  meta?: any,
  autoComplete: boolean = false
) {
  const tgUser = ctx.from!;
  clearSession(tgUser.id);

  try {
    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.reply('❌ User not found. Please /start first.');

    const deposit = await prisma.deposit.create({
      data: {
        userId: user.id,
        amount,
        txnId: referenceOrSms,
        receiptUrl: screenshotFileId ?? null,
        status: autoComplete ? 'completed' : 'pending',
      },
    });

    if (autoComplete) {
      try {
        const { creditWallet, creditBonus } = await import('../../services/wallet.service');
        logger.info(`[Deposit] Auto-completing deposit ${deposit.id} for user ${user.id}`);
        
        await creditWallet(user.id, amount, 'DEPOSIT', deposit.id, `Automatic Telebirr Deposit: ${referenceOrSms}`);
        
        const bonusAmount = amount * 0.5;
        await creditBonus(user.id, bonusAmount, `Telebirr Deposit Bonus (50%) for deposit #${deposit.id}`);
        
        logger.info(`[Deposit] Successfully credited user ${user.id} for deposit ${deposit.id}`);
      } catch (creditErr) {
        logger.error(`[Deposit] Failed to auto-credit user ${user.id} for deposit ${deposit.id}:`, creditErr);
        // Fallback: set back to pending so admin can fix it
        await prisma.deposit.update({ where: { id: deposit.id }, data: { status: 'pending', details: 'Auto-credit failed, needs manual review' } });
        autoComplete = false; 
      }
    }

    logger.info(`[Deposit] ${deposit.id} — ${amount} ETB — method: ${paymentMethod ?? 'unknown'} — auto: ${autoComplete}`);

    const methodLabel =
      paymentMethod === 'telebirr' ? 'Telebirr' :
      paymentMethod === 'cbe_birr' ? 'CBE-Birr' :
      paymentMethod === 'cbe_bank' ? 'CBE Bank' :
      paymentMethod === 'mpesa'    ? 'MPESA'    : 'Manual';

    if (autoComplete) {
      await ctx.reply(
        `✅ *ገቢዎ ተሳክቷል! (Deposit Successful)*\n\n` +
        `💵 መጠን (Amount): *${amount.toFixed(2)} ETB*\n` +
        `🎁 ቦነስ (Bonus): *${(amount * 0.5).toFixed(2)} ETB (50%)*\n` +
        `💳 መንገድ (Method): *${methodLabel}*\n` +
        `📋 ሁኔታ (Status): *ተጠናቋል (SUCCESS)*\n\n` +
        `💰 ሂሳብዎ ገቢ ሆኗል። መልካም እድል! 🎰`,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('💰 ሂሳብ ይመልከቱ (Check Balance)', 'cmd_balance')],
            [Markup.button.callback('🏠 ወደ ዋና ማውጫ (Main Menu)', 'cmd_start_main')],
          ])
        }
      );
    } else {
      await ctx.reply(
        `⏳ *ደረሰኙን እያረጋገጥን ነው... (Processing)*\n\n` +
        `💵 መጠን (Amount): *${amount.toFixed(2)} ETB*\n` +
        `💳 መንገድ (Method): *${methodLabel}*\n` +
        `📋 ሁኔታ (Status): *በሂደት ላይ (Pending)*\n\n` +
        `⏱ ይህ ክፍያ በሰው መረጋገጥ ስላለበት እባክዎ ለ **2-5 ደቂቃዎች** ይጠብቁ። ሲረጋገጥ መልዕክት ይደርስዎታል። 🙏`,
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🏠 ወደ ዋና ማውጫ (Main Menu)', 'cmd_start_main')],
          ])
        }
      );
    }

    // Notify admins
    const userName = tgUser.username ? `@${tgUser.username}` : user.firstName;
    const isSms = paymentMethod === 'telebirr';

    let adminCaption = autoComplete
      ? `🤖 *[AUTO-APPROVED] — ${methodLabel}*\n\n`
      : `📥 *[MANUAL REVIEW] — ${methodLabel}*\n\n`;
    
    adminCaption += 
      `👤 User: ${userName}\n` +
      `💵 Amount: *${amount.toFixed(2)} ETB*\n` +
      `🆔 Deposit ID: \`${deposit.id}\`\n\n`;

    if (paymentMethod === 'telebirr' && meta) {
      const d = meta;
      const receiptUrl = `https://transactioninfo.ethiotelecom.et/receipt/${d.transactionId}`;
      adminCaption += 
        `📱 *Telebirr Receipt Details*\n` +
        `\`\`\`\n` +
        `Dear ${d.senderName},\n` +
        `You have transferred ETB ${d.amount.toFixed(2)} to ${d.recipientName} (${d.recipientPhoneMasked}) ` +
        `on ${d.dateTime}. Your transaction number is ${d.transactionId}. ` +
        `The service fee is ETB ${d.serviceFee.toFixed(2)}.\n` +
        `\`\`\`\n` +
        `🔗 *Hit link to view receipt:* \n${receiptUrl}`;
    } else {
      adminCaption += isSms
        ? `📱 SMS Receipt:\n\`\`\`\n${referenceOrSms}\n\`\`\``
        : `🔖 Reference: \`${referenceOrSms}\``;
    }

    const adminKeyboard = autoComplete 
      ? undefined // No buttons needed for automatic deposits
      : Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Approve', `approve_dep_${deposit.id}`),
            Markup.button.callback('❌ Reject',  `reject_dep_${deposit.id}`),
          ],
        ]);

    for (const adminIdStr of config.bot.adminIds) {
      try {
        const adminTgId = parseInt(adminIdStr, 10);
        if (screenshotFileId) {
          await ctx.telegram.sendPhoto(adminTgId, screenshotFileId, {
            caption: adminCaption,
            parse_mode: 'Markdown',
            ...adminKeyboard,
          });
        } else {
          await ctx.telegram.sendMessage(adminTgId, adminCaption, {
            parse_mode: 'Markdown',
            ...adminKeyboard,
          });
        }
      } catch (e) {
        logger.warn(`[Deposit] Could not notify admin ${adminIdStr}:`, e);
      }
    }
  } catch (err: any) {
    logger.error('[Deposit] Submit error:', err);
    await ctx.reply('❌ Something went wrong. Please try again or contact support.');
  }
}
