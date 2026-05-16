import { Context, Markup } from 'telegraf';
import { config } from '../../config';

export async function handlePlayBingoMenu(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  await ctx.reply(
    `🍀 Best of luck on your Bingo game adventure! 🎮\n` +
    `🍀 ለቢንጎ ጨዋታዎ መልካም እድል! 🎮`,
    Markup.inlineKeyboard([
      // ── Row 1 ────────────────────────────────────────────────────────────────
      [
        Markup.button.webApp('🎮 Bingo 10 ይጫወቱ',   `${config.bot.miniAppUrl}/`),
        Markup.button.webApp('🎮 Bingo 20 ይጫወቱ',   `${config.bot.miniAppUrl}/`),
      ],
      // ── Row 2 ────────────────────────────────────────────────────────────────
      [
        Markup.button.webApp('🎮 Bingo 50 ይጫወቱ',   `${config.bot.miniAppUrl}/`),
        Markup.button.webApp('🎮 Bingo 100 ይጫወቱ',  `${config.bot.miniAppUrl}/`),
      ],
      // ── Row 3: Demo (full-width) ──────────────────────────────────────────────
      [
        Markup.button.webApp('🎮 በነጻ ይሞክሩ (Demo)', `${config.bot.miniAppUrl}/`),
      ],
    ])
  );
}
