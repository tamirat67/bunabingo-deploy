import { Context, Markup } from 'telegraf';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { getOrCreateWallet } from '../../services/wallet.service';
import prisma from '../../lib/prisma';

/**
 * Handles the 'cmd_play_slot' inline button callback.
 * Opens the Buna Hot 5 mini-app page.
 * Mirrors the aviator.ts handler pattern exactly.
 */
export async function handlePlaySlot(ctx: Context) {
  await ctx.answerCbQuery().catch(() => {});
  const tgUser = ctx.from!;

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(tgUser.id) },
      select: { id: true, firstName: true, status: true },
    });

    if (!user) {
      await ctx.reply(
        '❌ መለያ አልተገኘም። እባክዎ /start ን ይጫኑ።',
        Markup.inlineKeyboard([[
          Markup.button.callback('🏠 ወደ ዋና ማውጫ', 'cmd_start'),
        ]]),
      );
      return;
    }

    if (user.status === 'BANNED') {
      await ctx.reply('⛔ መለያዎ ታግዷል። ለተጨማሪ መረጃ ድጋፍ ያግኙ።');
      return;
    }

    const wallet  = await getOrCreateWallet(user.id);
    const balance = parseFloat(wallet.balance.toString()).toFixed(2);
    const bonus   = parseFloat(wallet.bonusBalance.toString()).toFixed(2);

    const slotUrl = `${config.bot.miniAppUrl}/play/slot`;

    const text =
      `🎰 <b>Buna Hot 5 — Classic Slot</b>\n\n` +
      `💰 <b>ሂሳብ:</b> ${balance} ETB\n` +
      `🎁 <b>ቦነስ:</b> ${bonus} ETB\n\n` +
      `🍒 ክላሲክ ፍራፍሬ ስሎት | 3×3 Grid | 5 Paylines\n` +
      `✨ እስከ <b>15x</b> ሙሊፕሊየር | Double-or-Nothing Gamble\n\n` +
      `👇 ከታች ያለውን ቁልፍ ጫኑ ለመጀመር፡`;

    await ctx.replyWithHTML(
      text,
      Markup.inlineKeyboard([
        [Markup.button.webApp('🎰 Buna Hot 5 ይጫወቱ', slotUrl)],
        [
          Markup.button.callback('🎮 Bingo ይጫወቱ', 'cmd_play_bingo'),
          Markup.button.callback('✈️ Aviator', 'cmd_play_aviator'),
        ],
        [Markup.button.callback('💰 ሂሳብ ማውጫ', 'cmd_balance')],
        [Markup.button.callback('🏠 ዋና ማውጫ', 'cmd_start')],
      ]),
    );

    logger.info(`[SlotBot] User ${tgUser.id} opened Buna Hot 5 menu`);
  } catch (err: any) {
    logger.error('[SlotBot] handlePlaySlot error:', err.message);
    await ctx.reply('❌ ችግር ተከስቷል፣ እባክዎ እንደገና ይሞክሩ።');
  }
}
