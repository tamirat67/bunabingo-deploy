import { Context, Markup } from 'telegraf';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { getOrCreateWallet } from '../../services/wallet.service';
import prisma from '../../lib/prisma';

/**
 * Handles the 'cmd_play_aviator' inline button callback.
 * Opens the Aviator mini-app page directly inside the Telegram WebApp.
 * Does NOT touch any Bingo code.
 */
export async function handlePlayAviator(ctx: Context) {
  await ctx.answerCbQuery().catch(() => {});
  const tgUser = ctx.from!;

  try {
    // Find user and their wallet
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

    const aviatorUrl = `${config.bot.miniAppUrl}/play/aviator`;

    const text =
      `✈️ <b>Aviator — ቡና ጌም ዞን</b>\n\n` +
      `💰 <b>ሂሳብ:</b> ${balance} ETB\n` +
      `🎁 <b>ቦነስ:</b> ${bonus} ETB\n\n` +
      `🛩️ የ Aviator ጨዋታ ቡናዎ ሲጠጡ ያስደሳቹ!\n` +
      `✅ ቁፋሮ ቡና ቢንጎ ልምድ፣ አሁን Aviator ደምቋል!\n\n` +
      `👇 ከታች ያለውን ቁልፍ ጫኑ ለመጀመር፡`;

    await ctx.replyWithHTML(text,
      Markup.inlineKeyboard([
        [
          Markup.button.webApp('✈️ Aviator ይጫወቱ', aviatorUrl),
        ],
        [
          Markup.button.callback('🎮 Bingo ይጫወቱ', 'cmd_play_bingo'),
          Markup.button.callback('💰 ሂሳብ ማውጫ', 'cmd_balance'),
        ],
        [
          Markup.button.callback('🏠 ዋና ማውጫ', 'cmd_start'),
        ],
      ])
    );

    logger.info(`[Aviator] User ${tgUser.id} opened Aviator menu`);
  } catch (err: any) {
    logger.error('[Aviator] handlePlayAviator error:', err.message);
    await ctx.reply('❌ ችግር ተከስቷል፣ እባክዎ እንደገና ይሞክሩ።');
  }
}
