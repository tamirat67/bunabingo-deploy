import { Context, Markup } from 'telegraf';
import { config } from '../../config';

export async function handlePlaySpinMenu(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  await ctx.reply(
    `🍀 Best of luck on your Spin game adventure! 🎮\n` +
    `🍀 ለስፒን ጨዋታዎ መልካም እድል! 🎮`,
    Markup.inlineKeyboard([
      // ── Row 1 ────────────────────────────────────────────────────────────────
      [
        Markup.button.webApp('🎮 Spin 10 ይጫወቱ',   `${config.bot.miniAppUrl}/tickets/select?type=SPIN_10&price=10`),
        Markup.button.webApp('🎮 Spin 20 ይጫወቱ',   `${config.bot.miniAppUrl}/tickets/select?type=SPIN_20&price=20`),
      ],
      // ── Row 2 ────────────────────────────────────────────────────────────────
      [
        Markup.button.webApp('🎮 Spin 50 ይጫወቱ',   `${config.bot.miniAppUrl}/tickets/select?type=SPIN_50&price=50`),
        Markup.button.webApp('🎮 Spin 100 ይጫወቱ',  `${config.bot.miniAppUrl}/tickets/select?type=SPIN_100&price=100`),
      ],
      // ── Row 3: Demo (full-width) ──────────────────────────────────────────────
      [
        Markup.button.webApp('🎮 በነጻ ይሞክሩ (Demo)', `${config.bot.miniAppUrl}/tickets/select?type=DEMO&price=0`),
      ],
    ])
  );
}
