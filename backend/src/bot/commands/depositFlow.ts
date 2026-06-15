import { Context, Markup } from 'telegraf';
import { Message } from 'telegraf/types';
import { getUserByTelegramId } from '../../services/user.service';
import { setSession, getSession, clearSession, PaymentMethod } from '../session';
import { config } from '../../config';
import prisma from '../../lib/prisma';
import { logger } from '../../lib/logger';

// ─── Default fallback deposit accounts (master admin — LUEL G/Libanos) ────────
const DEFAULT_DEPOSIT_ACCOUNTS = [
  { name: 'LUEL G/Libanos', phone: '0969455111', last4: '5111' }
];

interface AgentProfile {
  displayName: string;
  contactPhone: string | null;
  telegramUsername: string | null;
}

async function getAgentProfileForUser(userId: string): Promise<AgentProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { referrer: true }
  });

  const referrer = user?.referrer;
  // If the user is an AGENT or ADMIN, or has no referrer, they deposit to the master admin.
  if (!referrer || user?.role === 'AGENT' || user?.role === 'ADMIN' || user?.role === 'admin') {
    const defaultAgent = await prisma.user.findFirst({ where: { telegramId: BigInt('5310030963') } });
    if (!defaultAgent) {
      return {
        displayName: 'LUEL G/Libanos',
        contactPhone: '0969455111',
        telegramUsername: 'Luel1616',
      };
    }
    return {
      displayName: defaultAgent.firstName || defaultAgent.telegramUsername || 'LUEL G/Libanos',
      contactPhone: defaultAgent.phone || defaultAgent.phoneNumber || '0969455111',
      telegramUsername: defaultAgent.telegramUsername || 'Luel1616',
    };
  }

  return {
    displayName: [referrer.firstName, referrer.lastName].filter(Boolean).join(' ') || referrer.telegramUsername || 'Agent',
    contactPhone: referrer.phone || referrer.phoneNumber || null,
    telegramUsername: referrer.telegramUsername || null,
  };
}

async function getDepositAccountsForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { referrer: true }
  });

  let depositPhones: any[] = [];

  // If the user is a normal player and has a referrer, they deposit to their agent.
  // AGENTs and ADMINs bypass this and always deposit to the master admin.
  const isAgentOrAdmin = user?.role === 'AGENT' || user?.role === 'ADMIN' || user?.role === 'admin';
  if (user?.referrer && !isAgentOrAdmin) {
    const refPhones = user.referrer.depositPhones as any[];
    if (refPhones && refPhones.length > 0) {
      depositPhones = refPhones;
    } else if (user.referrer.phone || user.referrer.phoneNumber) {
      const phone = user.referrer.phone || user.referrer.phoneNumber;
      depositPhones = [{
        name: user.referrer.firstName || user.referrer.telegramUsername || 'Agent',
        phone: phone,
        last4: phone.slice(-4)
      }];
    }
  }

  // Fallback to master admin
  if (depositPhones.length === 0) {
    const defaultAgent = await prisma.user.findFirst({
      where: { telegramId: BigInt('5310030963') }
    });
    const defPhones = defaultAgent?.depositPhones as any[];
    if (defPhones && defPhones.length > 0) {
      depositPhones = defPhones;
    } else if (defaultAgent && (defaultAgent.phone || defaultAgent.phoneNumber)) {
      const phone = defaultAgent.phone || defaultAgent.phoneNumber;
      depositPhones = [{
        name: defaultAgent.firstName || defaultAgent.telegramUsername || 'Teme',
        phone: phone,
        last4: phone.slice(-4)
      }];
    } else {
      depositPhones = [{
        name: 'LUEL G/Libanos',
        phone: '0969455111',
        last4: '5111'
      }];
    }
  }

  if (depositPhones && depositPhones.length > 0) {
    return depositPhones.map(p => ({
      name: p.name,
      phone: p.phone,
      last4: p.last4 || p.phone.slice(-4)
    }));
  }
  return DEFAULT_DEPOSIT_ACCOUNTS;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateReference(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const CANCEL_BTN = [[Markup.button.callback('❌ ሰርዝ', 'cmd_deposit_cancel')]];

// ─── Dynamic payment card (supports multiple accounts + full Amharic instructions) ────
function buildPaymentCard(amount: number, reference: string, accounts: {name: string, phone: string}[], agentProfile?: AgentProfile | null): string {
  let accountsList = '';
  const letters = ['🅐', '🅑', '🅒', '🅓', '🅔'];
  accounts.forEach((acc, i) => {
    let localPhone = acc.phone.startsWith('251') ? '0' + acc.phone.slice(3) : acc.phone;
    let intPhone = localPhone.startsWith('0') ? '251' + localPhone.slice(1) : acc.phone;
    accountsList += `👤 <b>${letters[i % letters.length]} ${acc.name}</b>\n` +
      `📞 ስልክ ቁጥር (ጫኑ → ኮፒ ይሆናል):\n` +
      `  🌍 <code>${intPhone}</code>\n` +
      `  📱 <code>${localPhone}</code>\n\n`;
  });

  let agentHeader = '';
  if (agentProfile) {
    agentHeader = `🏦 <b>የእርስዎ ኤጀንት (Agent):</b>\n`;
    agentHeader += `   👤 <b>${agentProfile.displayName}</b>\n`;
    if (agentProfile.contactPhone) {
      const cp = agentProfile.contactPhone;
      const localCp = cp.startsWith('251') ? '0' + cp.slice(3) : cp;
      agentHeader += `   📞 <code>${localCp}</code>\n`;
    }
    if (agentProfile.telegramUsername) {
      agentHeader += `   💬 @${agentProfile.telegramUsername}\n`;
    }
    agentHeader += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  }

  return (
    `💳 <b>የቴሌብር ክፍያ ዝርዝር</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    agentHeader +
    `💵 <b>ክፍያ:</b>  ${amount} ብር (ETB)\n` +
    `📌 <b>Ref:</b>  <code>${reference}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    accountsList +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 <b>እንዴት ክፍያ ይፈጸማል:</b>\n\n` +
    `1️⃣ ከላይ ካሉ ስልኮች <b>አንዱን ኮፒ ያድርጉ</b>\n` +
    `2️⃣ ቴሌብር ይክፈቱ → <b>ላኩ / Send Money</b>\n` +
    `3️⃣ ቁጥሩን ለጥፈው <b>${amount} ብር</b> ይላኩ\n` +
    `4️⃣ ቴሌብር የሚልከውን <b>SMS ይጠብቁ</b>\n` +
    `5️⃣ SMS ሲደርስ ሙሉ ጽሁፉን <b>ኮፒ</b> አድርገው <b>ከዚህ ያስገቡ 👇</b>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🤖 <i>ስርዓቱ SMS-ን ራሱ ያረጋግጣል — ለሁሉም አካውንቶች ይሰራል።</i>`
  );
}

// ─── Step 1: Ask for amount ───────────────────────────────────────────────────
export async function handleDepositManualStart(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const tgUser = ctx.from!;
  const user = await getUserByTelegramId(tgUser.id);
  if (!user) return ctx.reply('❌ እባክዎ አስቀድመው /start ን በመጫን ይመዝገቡ።');
  setSession(tgUser.id, { type: 'MANUAL_DEPOSIT', step: 'AWAITING_AMOUNT' });

  // Show agent info prominently before asking for amount
  const agentProfile = await getAgentProfileForUser(user.id);
  let agentLine = '';
  if (agentProfile) {
    agentLine = `\n🏦 *የእርስዎ ኤጀንት:* ${agentProfile.displayName}`;
    if (agentProfile.contactPhone) {
      const cp = agentProfile.contactPhone;
      const localCp = cp.startsWith('251') ? '0' + cp.slice(3) : cp;
      agentLine += `\n📞 *ኤጀንት ስልክ:* \`${localCp}\``;
    }
    if (agentProfile.telegramUsername) {
      const safeUsername = agentProfile.telegramUsername.replace(/_/g, '\\_');
      agentLine += `\n💬 *ቴሌግራም:* @${safeUsername}`;
    }
    agentLine += `\n`;
  }

  await ctx.reply(
    `💳 *ብር ማስገቢያ*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━${agentLine}\n` +
    `እንዲሞላልዎት የሚፈልጉትን የገንዘብ መጠን በብር (ETB) ያስገቡ:\n\n` +
    `ዝቅተኛው መጠን፡ 10 ብር (ETB)`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard(CANCEL_BTN) }
  );
}

// ─── Cancel ───────────────────────────────────────────────────────────────────
export async function handleDepositCancel(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  clearSession(ctx.from!.id);
  await ctx.reply('❌ ብር ማስገቢያው ተሰርዟል።');
}

// ─── Legacy submit (kept for compatibility) ───────────────────────────────────
export async function handleDepositSubmit(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  const session = getSession(ctx.from!.id);
  if (!session || session.type !== 'MANUAL_DEPOSIT') return;
  await submitDeposit(ctx, session.amount!, session.reference!, undefined, session.paymentMethod);
}

// ─── handlePayAccount — generic quick confirm shortcut ─────────────
export async function handlePayAccount(ctx: Context, match: RegExpMatchArray) {
  if (ctx.callbackQuery) await ctx.answerCbQuery('✅ ተመርጧል — SMS ይላኩ');
  const session = getSession(ctx.from!.id);
  if (!session || session.type !== 'MANUAL_DEPOSIT') return;
  if (session.step !== 'AWAITING_SMS') {
    setSession(ctx.from!.id, { ...session, paymentMethod: 'telebirr', step: 'AWAITING_SMS' });
  }
  const phone = match[1];
  await ctx.replyWithHTML(
    `✅ <b>የክፍያ አካውንት</b> ተመርጧል\n\n` +
    `📞 <code>${phone}</code> ወደዚህ ቁጥር ክፍያ ከፈሉ\n\n` +
    `ቴሌብር SMS ሲደርስ ሙሉ ጽሁፉን ኮፒ አድርገው ከዚህ ያስገቡ 👇`,
    { ...Markup.inlineKeyboard(CANCEL_BTN) }
  );
}

// ─── Main message router ──────────────────────────────────────────────────────
export async function handleDepositMessage(ctx: Context): Promise<boolean> {
  const tgUser = ctx.from!;
  const session = getSession(tgUser.id);
  if (!session || session.type !== 'MANUAL_DEPOSIT') return false;
  const msg = ctx.message as any;

  // ── AWAITING_AMOUNT: validate amount, jump directly to AWAITING_SMS ──────────
  if (session.step === 'AWAITING_AMOUNT') {
    const raw = (msg as Message.TextMessage)?.text?.trim();
    const amount = parseFloat(raw);

    if (!raw || isNaN(amount) || amount < 10) {
      await ctx.reply(
        `⚠️ የተሳሳተ የገንዘብ መጠን። እባክዎ ከ 10 ብር በላይ ያስገቡ።`,
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard(CANCEL_BTN) }
      );
      return true;
    }

    const reference = generateReference();
    // Go DIRECTLY to AWAITING_SMS — no intermediate choice step needed
    setSession(tgUser.id, {
      type: 'MANUAL_DEPOSIT',
      step: 'AWAITING_SMS',
      amount,
      reference,
      paymentMethod: 'telebirr',
    });

    const user = await getUserByTelegramId(tgUser.id);
    const accounts = await getDepositAccountsForUser(user!.id);
    const agentProfile = await getAgentProfileForUser(user!.id);

    const letters = ['🅐', '🅑', '🅒', '🅓', '🅔'];
    const buttons = accounts.map((acc: any, idx: number) => {
      const shortName = acc.name.split(' ')[0];
      return [Markup.button.callback(`${letters[idx % letters.length]} ${shortName} — ${acc.phone}`, `cmd_pay_${acc.phone}`)];
    });
    buttons.push([Markup.button.callback('❌ ሰርዝ', 'cmd_deposit_cancel')]);

    await ctx.replyWithHTML(
      buildPaymentCard(amount, reference, accounts, agentProfile),
      {
        ...Markup.inlineKeyboard(buttons),
      }
    );
    return true;
  }

  // ── AWAITING_SMS: validate SMS then immediately credit wallet ─────────────────
  if (session.step === 'AWAITING_SMS') {
    const smsText = (msg as Message.TextMessage)?.text?.trim();

    if (!smsText || smsText.length < 30) {
      await ctx.replyWithHTML(
        `⚠️ <b>SMS አጭር ነው።</b>\n\n` +
        `ከቴሌብር የደረሰዎን SMS ሙሉ ጽሁፍ ኮፒ አድርገው ያስገቡ።\n` +
        `<i>SMS ይህን ይመስላል: "Dear [ስምዎ], You have transferred..."</i>`,
        { ...Markup.inlineKeyboard(CANCEL_BTN) }
      );
      return true;
    }

    // ── Layer 1: Parse + internal self-verification ───────────────────────────
    await ctx.replyWithHTML(
      `🔍 <b>SMS እየተረጋገጠ ነው...</b>\n` +
      `<i>(AI Bot)ስርዓቱ በርካታ የማረጋገጫ ደረጃዎችን እያካሄደ ነው — እባክዎ ይጠብቁ።</i>`
    );

    const { validateTelebirrSms } = await import('../../services/bunafrankValidator');
    // Pass '' as receiverPhone — validator uses hardcoded accounts internally
    const result = await validateTelebirrSms(smsText, session.amount!, tgUser.id.toString());

    if (!result.valid) {
      await ctx.replyWithHTML(
        `❌ <b>ማረጋገጫ አልተሳካም!</b>\n\n` +
        `${result.error ?? 'SMS ሊታወቅ አልቻለም።'}\n\n` +
        `<i>ትክክለኛ የቴሌብር SMS ኮፒ አድርገው እንደገና ይሞክሩ።</i>`,
        { ...Markup.inlineKeyboard(CANCEL_BTN) }
      );
      return true;
    }

    const d = result.data!;

    // ── Layer 2: Duplicate transaction guard ─────────────────────────────────
    const existing = await prisma.deposit.findUnique({ where: { txnId: d.transactionId } });
    if (existing) {
      await ctx.replyWithHTML(
        `❌ <b>ይህ ደረሰኝ ቀድሞ ጥቅም ላይ ውሏል!</b>\n\n` +
        `የግብይት መለያ <code>${d.transactionId}</code> ቀድሞ ገቢ ሆኗል።\n` +
        `<i>አንድ ደረሰኝ ከአንድ ጊዜ በላይ ሊጠቅም አይችልም።</i>`
      );
      clearSession(tgUser.id);
      return true;
    }

    // ── Auto-detect which account was used (bot verifies its own conclusion) ──
    const user = await getUserByTelegramId(tgUser.id);
    const accounts = await getDepositAccountsForUser(user!.id);
    const matchedAccount = accounts.find((a: any) => a.last4 === d.recipientPhoneLast4);
    const verifiedBadge = result.onlineVerified
      ? '✅ ኦፊሴላዊ ዌብሳይት ላይ ተረጋግጧል'
      : '✅ SMS ምዝገባ ተሳካ — ሂሳብ ተሞልቷል';

    await ctx.replyWithHTML(
      `✅ <b>SMS ተረጋግጧል!</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔖 <b>የግብይት ID:</b>  <code>${d.transactionId}</code>\n` +
      `💵 <b>ክፍያ:</b>        ${d.amount.toFixed(2)} ብር (ETB)\n` +
      `👤 <b>ተቀባይ:</b>       ${matchedAccount?.name ?? d.recipientName}\n` +
      `📞 <b>ስልክ:</b>        ${d.recipientPhoneMasked}\n` +
      `📅 <b>ቀን:</b>         ${d.dateTime}\n` +
      `💸 <b>ክፍያ አገ.:</b>   ${d.serviceFee.toFixed(2)} ብር\n` +
      `🔐 <b>ሁኔታ:</b>        ${verifiedBadge}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `⏳ ገቢዎን እያስተናገድን ነው...`
    );

    // ── FIX: Credit wallet immediately after local SMS validation passes. ─────
    // Online verification (result.onlineVerified) is used for admin audit only —
    // it must NOT gate wallet crediting, since the scraper frequently times out.
    await submitDeposit(ctx, session.amount!, d.transactionId, undefined, 'telebirr', d, true);
    return true;
  }

  return false;
}

// ─── Final submission ─────────────────────────────────────────────────────────
async function submitDeposit(
  ctx: Context,
  amount: number,
  referenceOrTxnId: string,
  screenshotFileId: string | undefined,
  paymentMethod?: PaymentMethod,
  meta?: any,
  autoComplete: boolean = false
) {
  const tgUser = ctx.from!;
  clearSession(tgUser.id);

  try {
    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.reply('❌ እባክዎ አስቀድመው /start ን በመጫን ይመዝገቡ።');

    const deposit = await prisma.deposit.create({
      data: {
        userId: user.id,
        amount,
        txnId: referenceOrTxnId,
        receiptUrl: screenshotFileId ?? null,
        status: autoComplete ? 'completed' : 'pending',
      },
    });

    if (autoComplete) {
      try {
        const { creditWallet, creditBonus } = await import('../../services/wallet.service');
        const { isDepositBonusEligible } = await import('../../services/settings.service');
        const { percentage: bonusPercentage } = await isDepositBonusEligible(amount);
        logger.info(`[Deposit] Auto-completing deposit ${deposit.id} for user ${user.id}`);
        await creditWallet(user.id, amount, 'DEPOSIT', deposit.id, `Telebirr Deposit: ${referenceOrTxnId}`);
        const bonusAmount = amount * (bonusPercentage / 100);
        if (bonusAmount > 0) {
          await creditBonus(user.id, bonusAmount, `${bonusPercentage}% Telebirr Deposit Bonus for #${deposit.id}`);
        }

        // Log to Admin Logs so it shows up in System Logs page
        const systemAdmin = await prisma.user.findFirst({ where: { telegramId: BigInt('5310030963') } }) 
                         || await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'admin'] } } });
        if (systemAdmin) {
          await prisma.adminLog.create({
            data: { 
              adminId: systemAdmin.id, 
              targetUserId: user.id, 
              action: 'APPROVE_DEPOSIT', 
              details: { depositId: deposit.id, amount, bonus: bonusAmount, note: 'Auto-completed via SMS Bot' } 
            },
          });
        }

        logger.info(`[Deposit] ✅ Credited user ${user.id} +${amount} ETB for deposit ${deposit.id}`);
      } catch (creditErr) {
        logger.error(`[Deposit] Auto-credit failed for ${deposit.id}:`, creditErr);
        // Revert status to pending so admin can manually approve
        await prisma.deposit.update({
          where: { id: deposit.id },
          data: { status: 'pending', details: 'Auto-credit failed, needs manual review' },
        });
        autoComplete = false;
      }
    }

    logger.info(`[Deposit] ${deposit.id} — ${amount} ETB — auto: ${autoComplete}`);

    const methodLabel = paymentMethod === 'telebirr' ? 'Telebirr' :
                        paymentMethod === 'cbe_birr' ? 'CBE-Birr' :
                        paymentMethod === 'cbe_bank' ? 'CBE Bank' :
                        paymentMethod === 'mpesa'    ? 'MPESA'    : 'Manual';

    if (autoComplete) {
      const { isDepositBonusEligible } = await import('../../services/settings.service');
      const { percentage: bonusPercentage } = await isDepositBonusEligible(amount);
      const bonusAmount = amount * (bonusPercentage / 100);
      let replyMsg = `✅ *ገቢዎ ተሳክቷል!*\n\n💵 መጠን፡ *${amount.toFixed(2)} ብር (ETB)*\n`;
      if (bonusAmount > 0) {
        replyMsg += `🎁 ቦነስ (${bonusPercentage}%)፡ *${bonusAmount.toFixed(2)} ብር (ETB)*\n`;
      }
      replyMsg += `💳 መንገድ፡ *${methodLabel}*\n📋 ሁኔታ፡ *ተጠናቋል*\n\n💰 ሂሳብዎ ገቢ ሆኗል። መልካም እድል! 🎰`;
      await ctx.reply(replyMsg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💰 ሂሳብ ይመልከቱ', 'cmd_balance')],
          [Markup.button.callback('🏠 ወደ ዋና ማውጫ', 'cmd_start')],
        ]),
      });
    } else {
      // Auto-credit failed — notify user to wait for manual review
      await ctx.reply(
        `⏳ *ደረሰኙን እያረጋገጥን ነው...*\n\n` +
        `💵 መጠን፡ *${amount.toFixed(2)} ብር (ETB)*\n` +
        `💳 መንገድ፡ *${methodLabel}*\n📋 ሁኔታ፡ *በሂደት ላይ*\n\n` +
        `⏱ ለ *2-5 ደቂቃዎች* ይጠብቁ። ሲረጋገጥ መልዕክት ይደርስዎታል። 🙏`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([[Markup.button.callback('🏠 ወደ ዋና ማውጫ', 'cmd_start')]]),
        }
      );
    }

    // ── Notify Agent / Admins ────────────────────────────────────────────────
    const userName = tgUser.username ? `@${tgUser.username}` : (user.firstName || 'User');
    const safeUserName = userName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    let adminCaption = autoComplete
      ? `🤖 <b>[AUTO-APPROVED] — ${methodLabel}</b>\n\n`
      : `📥 <b>[MANUAL REVIEW] — ${methodLabel}</b>\n\n`;
    adminCaption += `👤 User: ${safeUserName}\n💵 Amount: <b>${amount.toFixed(2)} ETB</b>\n🆔 Deposit ID: <code>${deposit.id}</code>\n\n`;

    if (meta) {
      const receiptUrl = `https://transactioninfo.ethiotelecom.et/receipt/${meta.transactionId}`;
      const safeSender = (meta.senderName || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeRecipient = (meta.recipientName || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      adminCaption +=
        `📱 <b>Telebirr Receipt</b>\n<pre>Dear ${safeSender},\nYou have transferred ETB ${meta.amount.toFixed(2)} to ${safeRecipient} (${meta.recipientPhoneMasked}) on ${meta.dateTime}. Txn: ${meta.transactionId}. Fee: ETB ${meta.serviceFee.toFixed(2)}.</pre>\n🔗 ${receiptUrl}`;
    } else {
      adminCaption += `🔖 Reference: <code>${referenceOrTxnId}</code>`;
    }

    const adminKeyboard = autoComplete
      ? undefined
      : Markup.inlineKeyboard([[
          Markup.button.callback('✅ Approve', `approve_dep_${deposit.id}`),
          Markup.button.callback('❌ Reject',  `reject_dep_${deposit.id}`),
        ]]);

    let notifyTgIds: number[] = [];

    // Notify the agent
    if (user.referredBy) {
      const agent = await prisma.user.findUnique({ where: { id: user.referredBy } });
      if (agent?.telegramId) {
        notifyTgIds.push(Number(agent.telegramId));
      }
    }

    // AND global admins from config
    const globalAdmins = config.bot.adminIds.map(id => parseInt(id, 10));
    for (const id of globalAdmins) {
      if (!notifyTgIds.includes(id)) notifyTgIds.push(id);
    }

    // AND all admins from Database (Fallback if .env is missing)
    const dbAdmins = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'admin'] } } });
    for (const adm of dbAdmins) {
      if (adm.telegramId) {
        const idNum = Number(adm.telegramId);
        if (!notifyTgIds.includes(idNum)) notifyTgIds.push(idNum);
      }
    }

    // ALWAYS ensure the master admin gets notified!
    const masterAdminId = 5310030963;
    if (!notifyTgIds.includes(masterAdminId)) {
      notifyTgIds.push(masterAdminId);
    }

    for (const adminTgId of notifyTgIds) {
      try {
        if (screenshotFileId) {
          await ctx.telegram.sendPhoto(adminTgId, screenshotFileId, {
            caption: adminCaption, parse_mode: 'HTML', ...adminKeyboard,
          });
        } else {
          await ctx.telegram.sendMessage(adminTgId, adminCaption, {
            parse_mode: 'HTML', ...adminKeyboard,
          });
        }
      } catch (e) {
        logger.warn(`[Deposit] Could not notify TG ID ${adminTgId}:`, e);
      }
    }
  } catch (err: any) {
    logger.error('[Deposit] Submit error:', err);
    await ctx.reply('❌ ችግር አጋጥሟል፣ እባክዎ እንደገና ይሞክሩ ወይም ድጋፍ ሰጪ ያግኙ።');
  }
}
