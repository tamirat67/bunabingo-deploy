import { Context, Markup } from 'telegraf';
import { Message } from 'telegraf/types';
import { getUserByTelegramId } from '../../services/user.service';
import { getOrCreateWallet, creditWallet, debitWallet } from '../../services/wallet.service';
import { setSession, getSession, clearSession, TransferSession } from '../session';
import { logger } from '../../lib/logger';
import prisma from '../../lib/prisma';

const CANCEL_BTN = [[Markup.button.callback('❌ ሰርዝ', 'cmd_transfer_cancel')]];

// ─── /transfer — Step 1: intro & ask for recipient ───────────────────────────
export async function handleTransfer(ctx: Context) {
  const tgUser = ctx.from!;

  try {
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.reply('❌ እባክዎ አስቀድመው /start ን በመጫን ይመዝገቡ።');

    const wallet  = await getOrCreateWallet(user.id);
    const balance = Number(wallet.balance);

    if (balance <= 0) {
      return ctx.reply(
        `💸 <b>ብር ማስተላለፊያ</b>\n\n` +
        `❌ ማስተላለፍ የሚችሉት በቂ ብር በሂሳብዎ ላይ የለም።\n\n` +
        `💰 ያሁኑ ሂሳብ፡ <b>0.00 ብር (ETB)</b>`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('💵 ብር ያስገቡ', 'cmd_deposit')],
          ]),
        }
      );
    }

    setSession(tgUser.id, { type: 'TRANSFER', step: 'AWAITING_RECIPIENT' });

    await ctx.reply(
      `💸 <b>ብር ማስተላለፊያ</b>\n\n` +
      `💰 የእርስዎ ሂሳብ፡ <b>${balance.toFixed(2)} ብር (ETB)</b>\n\n` +
      `እባክዎ የክፍያው ተቀባይ <b>የቴሌግራም ተጠቃሚ ስም (Telegram username)</b> ያስገቡ፦\n` +
      `<i>(ለምሳሌ፦ @username)</i>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(CANCEL_BTN),
      }
    );
  } catch (err: any) {
    logger.error('[Transfer] handleTransfer error:', err);
    await ctx.reply('❌ ችግር አጋጥሟል፣ እባክዎ እንደገና ይሞክሩ።');
  }
}

// ─── Cancel ───────────────────────────────────────────────────────────────────
export async function handleTransferCancel(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  clearSession(ctx.from!.id);
  await ctx.reply('❌ ብር ማስተላለፉ ተሰርዟል።');
}

// ─── Confirm callback ─────────────────────────────────────────────────────────
export async function handleTransferConfirm(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const tgUser  = ctx.from!;
  const session = getSession(tgUser.id) as TransferSession | undefined;

  if (!session || session.type !== 'TRANSFER' || session.step !== 'CONFIRMING') {
    return ctx.reply('❌ አሁን ላይ ምንም የጀመሩት ዝውውር የለም። እንደገና ለመጀመር /transfer ይበሉ።');
  }

  const { recipientId, recipientName, recipientUsername, amount } = session;
  clearSession(tgUser.id);

  if (!recipientId || !amount) {
    return ctx.reply('❌ ያልተሟላ የዝውውር መረጃ። እባክዎ እንደገና ለመጀመር /transfer ይበሉ።');
  }

  try {
    const sender = await getUserByTelegramId(tgUser.id);
    if (!sender) return ctx.reply('❌ ላኪው አልተገኘም።');

    // Debit sender
    await debitWallet(
      sender.id,
      amount,
      'WITHDRAWAL',
      undefined,
      `Transfer to @${recipientUsername ?? recipientId}`
    );

    // Credit recipient
    await creditWallet(
      recipientId,
      amount,
      'REFERRAL_BONUS',
      undefined,
      `Transfer from @${sender.telegramUsername ?? sender.firstName}`
    );

    logger.info(`[Transfer] ${sender.id} → ${recipientId}: ${amount} ETB`);

    await ctx.reply(
      `✅ <b>ብር ማስተላለፉ ተሳክቷል!</b>\n\n` +
      `👤 ተቀባይ፡ <b>${recipientName}</b>` +
      `${recipientUsername ? ` (@${recipientUsername})` : ''}\n` +
      `💸 መጠን፡ <b>${amount.toFixed(2)} ብር (ETB)</b>\n\n` +
      `ገንዘቡ በቅጽበት ተላልፏል። ☕️`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💰 ሂሳብ ይመልከቱ', 'cmd_balance')],
        ]),
      }
    );

    // Notify recipient (non-critical — may fail if they blocked the bot)
    const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
    if (recipient) {
      try {
        await ctx.telegram.sendMessage(
          Number(recipient.telegramId),
          `💸 <b>ብር ተላልፎልዎታል!</b>\n\n` +
          `👤 ላኪ፡ <b>${sender.firstName}</b>` +
          `${sender.telegramUsername ? ` (@${sender.telegramUsername})` : ''}\n` +
          `💰 መጠን፡ <b>${amount.toFixed(2)} ብር (ETB)</b>\n\n` +
          `ሂሳብዎ ላይ ገቢ ሆኗል። ☕️`,
          { parse_mode: 'HTML' }
        );
      } catch {
        logger.warn(`[Transfer] Could not notify recipient ${recipientId}`);
      }
    }
  } catch (err: any) {
    logger.error('[Transfer] Execution error:', err);
    await ctx.reply(`❌ ብር ማስተላለፉ አልተሳካም፡ ${err.message}`);
  }
}

// ─── Message router ───────────────────────────────────────────────────────────
export async function handleTransferMessage(ctx: Context): Promise<boolean> {
  const tgUser  = ctx.from!;
  const session = getSession(tgUser.id) as TransferSession | undefined;
  if (!session || session.type !== 'TRANSFER') return false;

  const msg  = ctx.message as any;
  const text = ((msg as Message.TextMessage)?.text ?? '').trim();

  // ── Step 2: Receive recipient username ────────────────────────────────────
  if (session.step === 'AWAITING_RECIPIENT') {
    if (!text) {
      await ctx.reply('⚠️ እባክዎ የቴሌግራም ተጠቃሚ ስም (Telegram username) ያስገቡ።', {
        ...Markup.inlineKeyboard(CANCEL_BTN),
      });
      return true;
    }

    const username = text.replace(/^@/, '').toLowerCase();

    const recipient = await prisma.user.findFirst({
      where: { telegramUsername: { equals: username, mode: 'insensitive' } },
      include: { wallet: true },
    });

    if (!recipient) {
      await ctx.reply(
        `❌ ተጠቃሚ <b>@${username}</b> አልተገኘም።\n` +
        `ተጠቃሚው በቡና ቢንጎ መመዝገቡን ያረጋግጡ።`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔄 እንደገና ይሞክሩ', 'cmd_transfer')],
            [Markup.button.callback('❌ ሰርዝ',    'cmd_transfer_cancel')],
          ]),
        }
      );
      return true;
    }

    if (recipient.telegramId === BigInt(tgUser.id)) {
      await ctx.reply('❌ ለራስዎ ብር ማስተላለፍ አይችሉም።', {
        ...Markup.inlineKeyboard(CANCEL_BTN),
      });
      return true;
    }

    const updated: TransferSession = {
      ...session,
      step:              'AWAITING_AMOUNT',
      recipientId:       recipient.id,
      recipientName:     recipient.firstName,
      recipientUsername: recipient.telegramUsername ?? username,
    };
    setSession(tgUser.id, updated);

    await ctx.reply(
      `✅ ተቀባይ፡ <b>${recipient.firstName}</b>` +
      `${recipient.telegramUsername ? ` (@${recipient.telegramUsername})` : ''}\n\n` +
      `💰 ማስተላለፍ የሚፈልጉትን የብር መጠን ያስገቡ <i>(ዝቅተኛ መጠን 10 ብር)</i>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(CANCEL_BTN),
      }
    );
    return true;
  }

  // ── Step 3: Receive amount ────────────────────────────────────────────────
  if (session.step === 'AWAITING_AMOUNT') {
    const amount = parseFloat(text);

    if (isNaN(amount) || amount < 10) {
      await ctx.reply('⚠️ እባክዎ ትክክለኛ የገንዘብ መጠን ያስገቡ (ዝቅተኛ መጠን 10 ብር)።', {
        ...Markup.inlineKeyboard(CANCEL_BTN),
      });
      return true;
    }

    const sender = await getUserByTelegramId(tgUser.id);
    if (!sender) return true;

    const wallet = await getOrCreateWallet(sender.id);
    if (Number(wallet.balance) < amount) {
      await ctx.reply(
        `❌ በቂ የገንዘብ መጠን በሂሳብዎ ላይ የለም።\n\n` +
        `💰 ያለዎት ሂሳብ፡ <b>${Number(wallet.balance).toFixed(2)} ብር (ETB)</b>\n` +
        `💸 ማስተላለፍ የፈለጉት፡ <b>${amount.toFixed(2)} ብር (ETB)</b>`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard(CANCEL_BTN),
        }
      );
      return true;
    }

    const updated: TransferSession = { ...session, step: 'CONFIRMING', amount };
    setSession(tgUser.id, updated);

    await ctx.reply(
      `📋 <b>እባክዎ ያረጋግጡ</b>\n\n` +
      `👤 ተቀባይ፡ <b>${session.recipientName}</b>` +
      `${session.recipientUsername ? ` (@${session.recipientUsername})` : ''}\n` +
      `💸 መጠን፡ <b>${amount.toFixed(2)} ብር (ETB)</b>\n\n` +
      `ማስተላለፍ ይፈልጋሉ?`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ አረጋግጥ', 'cmd_transfer_confirm'),
            Markup.button.callback('❌ ሰርዝ',  'cmd_transfer_cancel'),
          ],
        ]),
      }
    );
    return true;
  }

  return false;
}
