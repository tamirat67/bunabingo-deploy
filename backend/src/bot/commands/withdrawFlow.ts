import { Context, Markup } from 'telegraf';
import { getUserByTelegramId } from '../../services/user.service';
import { setSession, getSession, clearSession } from '../session';
import { createWithdrawalRequest } from '../../services/withdrawal.service';
import { logger } from '../../lib/logger';
import { config } from '../../config';

const CANCEL_BTN = [[Markup.button.callback('❌ ሰርዝ', 'cmd_withdraw_cancel')]];

export async function handleWithdrawStart(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const tgUser = ctx.from!;
  const user = await getUserByTelegramId(tgUser.id);
  if (!user) return ctx.reply('❌ እባክዎ አስቀድመው /start ን በመጫን ይመዝገቡ።');

  const balance = Number((user as any).wallet?.balance ?? 0);
  const bonusBalance = Number((user as any).wallet?.bonusBalance ?? 0);

  if (balance < config.withdrawal.minAmount) {
    return ctx.reply(
      `❌ በቂ ሂሳብ የለዎትም። ዝቅተኛው የማውጫ መጠን ${config.withdrawal.minAmount} ብር ነው።\n\n` +
      `💵 ዋና ሂሳብ (ሊወጣ የሚችል): *${balance.toFixed(2)} ETB*\n` +
      `🎁 የቦነስ ሂሳብ (ለጨዋታ ብቻ): *${bonusBalance.toFixed(2)} ETB*`,
      { parse_mode: 'Markdown' }
    );
  }

  setSession(tgUser.id, { type: 'WITHDRAWAL', step: 'AWAITING_AMOUNT' });

  await ctx.reply(
    `💸 *የገንዘብ ማውጫ ጥያቄ*\n\n` +
    `እንዲወጣልዎት የሚፈልጉትን የገንዘብ መጠን በብር (ETB) ያስገቡ:\n\n` +
    `💵 *ዋና ሂሳብ (ሊወጣ የሚችል)፡* *${balance.toFixed(2)} ብር (ETB)*\n` +
    `🎁 *የቦነስ ሂሳብ (ለጨዋታ ብቻ)፡* *${bonusBalance.toFixed(2)} ብር (ETB)*\n\n` +
    `⚠️ _ማሳሰቢያ: የቦነስ ሂሳብ ማውጣት አይቻልም (Bonus balance is strictly non-withdrawable)._\n\n` +
    `ዝቅተኛው መጠን፡ *${config.withdrawal.minAmount} ብር (ETB)*`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(CANCEL_BTN),
    }
  );
}

export async function handleWithdrawCancel(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  clearSession(ctx.from!.id);
  await ctx.reply('❌ የገንዘብ ማውጫው ተሰርዟል።');
}

export async function handleWithdrawMessage(ctx: Context): Promise<boolean> {
  const tgUser = ctx.from!;
  const session = getSession(tgUser.id);
  if (!session || session.type !== 'WITHDRAWAL') return false;

  const msg = ctx.message as any;
  const text = msg.text?.trim();

  // ── STEP 1: AWAITING_AMOUNT ───────────────────────────────────────────────
  if (session.step === 'AWAITING_AMOUNT') {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount < config.withdrawal.minAmount) {
      await ctx.reply(`⚠️ የተሳሳተ የገንዘብ መጠን። ዝቅተኛው፡ ${config.withdrawal.minAmount} ብር።`, {
        ...Markup.inlineKeyboard(CANCEL_BTN),
      });
      return true;
    }

    // Check if user actually has enough balance
    const user = await getUserByTelegramId(tgUser.id);
    const balance = Number((user as any)?.wallet?.balance ?? 0);

    if (amount > balance) {
      clearSession(tgUser.id);

      // Get agent's deposit phone for guidance
      let agentPhone = '';
      let agentName = '';
      if ((user as any)?.referrer) {
        const referrer = (user as any).referrer;
        const phones = referrer.depositPhones as any[];
        if (phones && phones.length > 0) {
          agentPhone = phones[0].phone;
          agentName = phones[0].name || referrer.firstName || referrer.telegramUsername || 'Agent';
        } else if (referrer.phone || referrer.phoneNumber) {
          agentPhone = referrer.phone || referrer.phoneNumber;
          agentName = referrer.firstName || referrer.telegramUsername || 'Agent';
        }
      }

      let depositInfo = '';
      if (agentPhone) {
        const localPhone = agentPhone.startsWith('251') ? '0' + agentPhone.slice(3) : agentPhone;
        depositInfo = `\n\n📥 *ብር ለማስገባት ወደዚህ ቁጥር ይላኩ:*\n👤 ${agentName}\n📞 \`${localPhone}\`\n\n_ቴሌብር → ላኩ → ቁጥሩን ያስገቡ_`;
      }

      await ctx.reply(
        `❌ *በቂ ሂሳብ የለዎትም!*\n\n` +
        `💵 ዋና ሂሳብ (ሊወጣ የሚችል): *${balance.toFixed(2)} ETB*\n` +
        `🔢 የጠየቁት መጠን: *${amount.toFixed(2)} ETB*\n\n` +
        `⚠️ _የጠየቁት መጠን ካለዎት ሂሳብ በላይ ነው።_` +
        depositInfo,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📥 ገቢ ለማድረግ', 'cmd_deposit')],
            [Markup.button.callback('🏠 ዋና ማውጫ', 'cmd_start')],
          ]),
        }
      );
      return true;
    }

    setSession(tgUser.id, { ...session, step: 'AWAITING_BANK', amount });
    await ctx.reply(`🏦 እባክዎ የባንክ ስም ያስገቡ (ለምሳሌ CBE, Telebirr, M-PESA)፦`, {
      ...Markup.inlineKeyboard(CANCEL_BTN),
    });
    return true;
  }

  // ── STEP 2: AWAITING_BANK ─────────────────────────────────────────────────
  if (session.step === 'AWAITING_BANK') {
    if (!text) return true;
    setSession(tgUser.id, { ...session, step: 'AWAITING_ACCOUNT', bankName: text });
    await ctx.reply(`💳 እባክዎ የሂሳብ ቁጥርዎን ያስገቡ:`, {
      ...Markup.inlineKeyboard(CANCEL_BTN),
    });
    return true;
  }

  // ── STEP 3: AWAITING_ACCOUNT ──────────────────────────────────────────────
  if (session.step === 'AWAITING_ACCOUNT') {
    if (!text) return true;
    setSession(tgUser.id, { ...session, step: 'AWAITING_NAME', accountNumber: text });
    await ctx.reply(`👤 እባክዎ የባለቤቱን ሙሉ ስም ያስገቡ:`, {
      ...Markup.inlineKeyboard(CANCEL_BTN),
    });
    return true;
  }

  // ── STEP 4: AWAITING_NAME ─────────────────────────────────────────────────
  if (session.step === 'AWAITING_NAME') {
    if (!text) return true;
    const accountName = text;
    const { amount, bankName, accountNumber } = session;

    clearSession(tgUser.id);

    try {
      const user = await getUserByTelegramId(tgUser.id);
      if (!user) throw new Error('User not found');

      await createWithdrawalRequest(user.id, amount!, bankName!, accountNumber!, accountName);

      await ctx.reply(
        `✅ *የገንዘብ ማውጫ ጥያቄዎ ተልኳል!*\n\n` +
        `💰 መጠን፡ *${amount!.toFixed(2)} ብር (ETB)*\n` +
        `🏦 ባንክ፡ *${bankName}*\n` +
        `📋 ሁኔታ፡ *በሂደት ላይ*\n\n` +
        `ጥያቄዎ ለኤጀንቱ ተልኳል። ሲረጋገጥ እና ክፍያ ሲፈጸም መልዕክት ይደርስዎታል። 🙏`,
        { parse_mode: 'Markdown' }
      );
    } catch (err: any) {
      logger.error('[Withdrawal] Submit error:', err);
      await ctx.reply(`❌ ስህተት፡ ${err.message || 'ችግር አጋጥሟል።'}`);
    }
    return true;
  }

  return false;
}
