import { Context, Markup } from 'telegraf';
import { config } from '../../config';

export async function handlePlaySpinMenu(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  await ctx.reply(
    `🍀 Best of luck on your Spin game adventure! 🎮\n` +
    `🍀 ለስፒን ጨዋታዎ መልካም እድል! 🎮`,
    Markup.inlineKeyboard([
      [
        Markup.button.webApp('🎰 Spin (Spin ተጫወት)', `${config.bot.miniAppUrl}/play/roulette`),
      ],
    ])
  );
}

/**
 * Answers the "spin_coming_soon" callback with a popup toast.
 * Registered in bot/index.ts via: bot.action('spin_coming_soon', handleSpinComingSoon)
 */
export async function handleSpinComingSoon(ctx: Context) {
  await ctx.answerCbQuery(
    '🚧 Coming Soon! / በቅርቡ ይመጣል! 🚧\n' +
    'Spin games are under development. Stay tuned! ☕',
    { show_alert: true }
  );
}
