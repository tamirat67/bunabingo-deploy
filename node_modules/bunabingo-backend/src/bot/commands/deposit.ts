import { Context, Markup } from 'telegraf';
import { getUserByTelegramId } from '../../services/user.service';
import { config } from '../../config';

// ─── Step 1: Show deposit method selector ─────────────────────────────────────
export async function handleDeposit(ctx: Context) {
  const tgUser = ctx.from!;

  try {
    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.reply('❌ Please /start first to register.');

    if (ctx.callbackQuery) await ctx.answerCbQuery();

    await ctx.reply(
      `Choose Your Preferred Deposit Method`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Telegram Star', 'cmd_deposit_stars')],
        [Markup.button.callback('Manual',        'cmd_deposit_manual')],
      ])
    );
  } catch (err) {
    await ctx.reply('❌ Error. Please try again.');
  }
}

// ─── Step 2a: Telegram Stars deposit ──────────────────────────────────────────
export async function handleDepositStars(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  await ctx.reply(
    `⭐ *Telegram Stars Deposit*\n\n` +
    `Pay instantly using your Telegram Stars balance.\n\n` +
    `📋 *How it works:*\n` +
    `1️⃣ Choose an amount below\n` +
    `2️⃣ Complete the payment inside Telegram\n` +
    `3️⃣ Your wallet is credited automatically ⚡\n\n` +
    `No waiting · No screenshots · Instant credit`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.webApp('⭐ 50 Stars',  `${config.bot.miniAppUrl}/deposit/stars?amount=50`),
          Markup.button.webApp('⭐ 100 Stars', `${config.bot.miniAppUrl}/deposit/stars?amount=100`),
        ],
        [
          Markup.button.webApp('⭐ 250 Stars', `${config.bot.miniAppUrl}/deposit/stars?amount=250`),
          Markup.button.webApp('⭐ 500 Stars', `${config.bot.miniAppUrl}/deposit/stars?amount=500`),
        ],
        [Markup.button.callback('⬅️ Back', 'cmd_deposit')],
      ]),
    }
  );
}

// ─── Step 2b: Manual deposit — kicks off in-bot conversation ──────────────────
export async function handleDepositManual(ctx: Context) {
  const { handleDepositManualStart } = await import('./depositFlow');
  await handleDepositManualStart(ctx);
}
