import { Context, Markup } from 'telegraf';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { getOrCreateWallet } from '../../services/wallet.service';
import prisma from '../../lib/prisma';

/**
 * Handles /playkeno command and 'cmd_play_keno' inline button callback.
 * Opens the Fast Keno mini-app page directly inside the Telegram WebApp.
 * Does NOT touch any Bingo code.
 */
export async function handlePlayKeno(ctx: Context) {
  // Handle both command and callback query
  if ('callback_query' in ctx.update) {
    await ctx.answerCbQuery().catch(() => {});
  }
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
        ]])
      );
      return;
    }

    if (user.status === 'BANNED') {
      await ctx.reply('⛔ መለያዎ ታግዷል። ለተጨማሪ መረጃ ድጋፍ ያግኙ።');
      return;
    }

    const wallet = await getOrCreateWallet(user.id);
    const balance = parseFloat(wallet.balance.toString()).toFixed(2);
    const bonus   = parseFloat(wallet.bonusBalance.toString()).toFixed(2);

    const kenoUrl = `${config.bot.miniAppUrl}/keno`;

    const text =
      `🎱 <b>Fast Keno — ቡና ጌም ዞን</b>\n\n` +
      `💰 <b>ሂሳብ:</b> ${balance} ETB\n` +
      `🎁 <b>ቦነስ:</b> ${bonus} ETB\n\n` +
      `🔢 ከ 1–80 ቁጥሮች ውስጥ 1–10 ቁጥሮችን ይምረጡ!\n` +
      `⚡ ፈጣን ዙሮች — እያንዳንዱ ዙር 4 ሰከንድ ብቻ!\n\n` +
      `👇 ከታች ያለውን ቁልፍ ጫኑ ለመጀመር:`;

    await ctx.replyWithHTML(text,
      Markup.inlineKeyboard([
        [
          Markup.button.webApp('🎱 Fast Keno ይጫወቱ', kenoUrl),
        ],
        [
          Markup.button.callback('✈️ Aviator ይጫወቱ', 'cmd_play_aviator'),
          Markup.button.callback('🎮 Bingo ይጫወቱ', 'cmd_play_bingo'),
        ],
        [
          Markup.button.callback('💰 ሂሳብ ማውጫ', 'cmd_balance'),
          Markup.button.callback('🏠 ዋና ማውጫ', 'cmd_start'),
        ],
      ])
    );

    logger.info(`[Keno] User ${tgUser.id} opened Fast Keno menu`);
  } catch (err: any) {
    logger.error('[Keno] handlePlayKeno error:', err.message);
    await ctx.reply('❌ ችግር ተከስቷል፣ እባክዎ እንደገና ይሞክሩ።');
  }
}
