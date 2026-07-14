import { Context, Markup } from 'telegraf';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { getOrCreateWallet } from '../../services/wallet.service';
import prisma from '../../lib/prisma';

/**
 * Handles the 'cmd_play_chicken_road' inline button callback.
 * Opens the Chicken Road mini-app page.
 * Mirrors the slot.ts handler pattern exactly.
 */
export async function handlePlayChickenRoad(ctx: Context) {
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

    const chickenRoadUrl = `${config.bot.miniAppUrl}/play/chicken-road`;

    const text =
      `🐔🛣️ <b>Chicken Road — Risk & Reward</b>\n\n` +
      `💰 <b>ሂሳብ:</b> ${balance} ETB\n` +
      `🎁 <b>ቦነስ:</b> ${bonus} ETB\n\n` +
      `🐔 ዶሮዋን አቋርጠው! ደረጃ በደረጃ ሂዱ — ሙሊፕሊየርዎ ይጨምራል!\n` +
      `🔥 ቀይ ሙቀቶችን ያስወግዱ | 4 የፈተና ደረጃዎች | Provably Fair\n\n` +
      `⚡️ <b>Easy / Medium / Hard / Extreme</b> — ደረጃ ይምረጡ!\n\n` +
      `👇 ከታች ያለውን ቁልፍ ጫኑ ለመጀመር፡`;

    await ctx.replyWithHTML(
      text,
      Markup.inlineKeyboard([
        [Markup.button.webApp('🐔 Chicken Road ይጫወቱ', chickenRoadUrl)],
        [
          Markup.button.callback('🎮 Bingo ይጫወቱ', 'cmd_play_bingo'),
          Markup.button.callback('✈️ Aviator',       'cmd_play_aviator'),
        ],
        [
          Markup.button.webApp('🎱 Fast Keno', `${config.bot.miniAppUrl}/keno`),
          Markup.button.callback('7️⃣🍒🍋 Multi Hot 5', 'cmd_play_slot'),
        ],
        [Markup.button.callback('💰 ሂሳብ ማውጫ', 'cmd_balance')],
        [Markup.button.callback('🏠 ዋና ማውጫ',   'cmd_start')],
      ]),
    );

    logger.info(`[ChickenRoadBot] User ${tgUser.id} opened Chicken Road menu`);
  } catch (err: any) {
    logger.error('[ChickenRoadBot] handlePlayChickenRoad error:', err.message);
    await ctx.reply('❌ ችግር ተከስቷል፣ እባክዎ እንደገና ይሞክሩ።');
  }
}
