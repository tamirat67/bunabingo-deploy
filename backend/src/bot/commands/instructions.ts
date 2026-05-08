import { Context } from 'telegraf';

export async function handleInstructions(ctx: Context) {
  const text = 
    `📖 <b>How to Play Buna Bingo</b>\n\n` +
    `1. <b>Register:</b> Create your account via the mini app.\n` +
    `2. <b>Deposit:</b> Add funds to your wallet using the Deposit button.\n` +
    `3. <b>Buy Tickets:</b> Choose a room and buy your bingo cards.\n` +
    `4. <b>Win:</b> Numbers are drawn automatically. First to complete the pattern wins!\n\n` +
    `Good luck! 🍀`;

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(text);
  } else {
    await ctx.replyWithHTML(text);
  }
}
