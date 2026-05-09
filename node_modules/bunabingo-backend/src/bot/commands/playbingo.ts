import { Context, Markup } from 'telegraf';
import { config } from '../../config';

export async function handlePlayBingoMenu(ctx: Context) {
  const text = `🍀 Best of luck on your Bingo game adventure! 🎮`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.webApp('🎮 Play Bingo Live', `${config.bot.miniAppUrl}/game`),
    ],
    [
      Markup.button.webApp('🎮 Play Bingo Lobby', `${config.bot.miniAppUrl}/`),
    ],
    [
      Markup.button.webApp('🎮 Play Demo Mode', `${config.bot.miniAppUrl}/game?mode=demo`),
    ],
  ]);

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
    await ctx.reply(text, keyboard);
  } else {
    await ctx.reply(text, keyboard);
  }
}
