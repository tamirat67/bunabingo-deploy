import { Context, Markup } from 'telegraf';
import { config } from '../../config';

export async function handlePlaySpinMenu(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  await ctx.reply(
    `🍀 Best of luck on your Spin game adventure! 🎮\n` +
    `🍀 ለስፒን ጨዋታዎ መልካም እድል! 🎮`,
    Markup.inlineKeyboard([
      // ── Row 1 ─────────────────────────────────────────────────────────────────
      [
        Markup.button.callback('🎮 Spin 10 ይጫወቱ',  'spin_coming_soon'),
        Markup.button.callback('🎮 Spin 20 ይጫወቱ',  'spin_coming_soon'),
      ],
      // ── Row 2 ─────────────────────────────────────────────────────────────────
      [
        Markup.button.callback('🎮 Spin 50 ይጫወቱ',  'spin_coming_soon'),
        Markup.button.callback('🎮 Spin 100 ይጫወቱ', 'spin_coming_soon'),
      ],
      // ── Row 3: Demo (full-width, still works) ─────────────────────────────────
      [
        Markup.button.webApp('🎮 በነጻ ይሞክሩ (Demo)', `${config.bot.miniAppUrl}/tickets/select?type=DEMO&price=0`),
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
