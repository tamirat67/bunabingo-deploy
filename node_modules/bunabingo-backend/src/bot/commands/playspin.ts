import { Context, Markup } from 'telegraf';
import { config } from '../../config';

export async function handlePlaySpinMenu(ctx: Context) {
  const text = `🍀 Best of luck on your Spin game adventure! 🎮`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.webApp('🎮 Play Spin 10',  `${config.bot.miniAppUrl}/spin?bet=10`),
      Markup.button.webApp('🎮 Play Spin 20',  `${config.bot.miniAppUrl}/spin?bet=20`),
    ],
    [
      Markup.button.webApp('🎮 Play Spin 50',  `${config.bot.miniAppUrl}/spin?bet=50`),
      Markup.button.webApp('🎮 Play Spin 100', `${config.bot.miniAppUrl}/spin?bet=100`),
    ],
    [
      Markup.button.webApp('🎮 Play Spin Demo', `${config.bot.miniAppUrl}/spin?mode=demo`),
    ],
  ]);

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
    await ctx.reply(text, keyboard);
  } else {
    await ctx.reply(text, keyboard);
  }
}
