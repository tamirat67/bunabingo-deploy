import { Context, Markup } from 'telegraf';
import { config } from '../../config';

export async function handlePlayBingoMenu(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  await ctx.reply(
    `🍀 Best of luck on your Bingo game adventure! 🎮\n` +
    `🍀 ለቢንጎ ጨዋታዎ መልካም እድል! 🎮`,
    Markup.inlineKeyboard([
      // ── Row 1: Low-Stakes ──────────────────────────────────────────────────────
      [
        Markup.button.webApp('🎮 Bingo 10 ይጫወቱ', `${config.bot.miniAppUrl}/tickets/select?type=CASUAL&price=10`),
        Markup.button.webApp('🎮 Bingo 20 ይጫወቱ', `${config.bot.miniAppUrl}/tickets/select?type=STANDARD&price=20`),
      ],
      // ── Row 2: Mid-Stakes & Practice ──────────────────────────────────────────
      [
        Markup.button.webApp('🎮 Bingo 50 ይጫወቱ', `${config.bot.miniAppUrl}/tickets/select?type=PRO&price=50`),
        Markup.button.webApp('🎮 በነጻ ይሞክሩ (Demo)', `${config.bot.miniAppUrl}/tickets/select?type=DEMO&price=0`),
      ],
      // ── Row 3: VIP High-Stakes (Separate at Bottom) ───────────────────────────
      [
        Markup.button.webApp('🎮 Bingo 100 ይጫወቱ', `${config.bot.miniAppUrl}/tickets/select?type=JACKPOT&price=100`),
        Markup.button.webApp('🎮 Bingo 200 ይጫወቱ', `${config.bot.miniAppUrl}/tickets/select?type=VIP&price=200`),
      ],
    ])
  );
}
