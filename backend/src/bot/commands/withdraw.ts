import { Context, Markup } from 'telegraf';
import { getUserByTelegramId } from '../../services/user.service';
import { createWithdrawalRequest } from '../../services/withdrawal.service';
import { config } from '../../config';

export async function handleWithdraw(ctx: Context) {
  const tgUser = ctx.from!;
  try {
    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.reply('❌ Please /start first.');

    const balance = Number((user as any).wallet?.balance ?? 0);

    const bannerUrl = `${process.env.WEBHOOK_URL}/uploads/banner.png`;
    const text = 
      `💸 *Withdraw Funds*\n\n` +
      `💰 Available Balance: *${balance.toFixed(2)} ETB*\n\n` +
      `📋 *Withdrawal Rules:*\n` +
      `• Minimum: ${config.withdrawal.minAmount} ETB\n` +
      `• Maximum: ${config.withdrawal.maxAmount} ETB\n` +
      `• Admin approval required (usually within 2 hours)\n` +
      `• Only one pending request at a time\n\n` +
      `Use the Mini App to submit your request 👇`;

    await ctx.replyWithPhoto(bannerUrl, {
      caption: text,
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('💸 Request Withdrawal', `${config.bot.miniAppUrl}/withdraw`)],
      ]),
    }).catch(() => {
      return ctx.reply(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('💸 Request Withdrawal', `${config.bot.miniAppUrl}/withdraw`)],
        ]),
      });
    });
  } catch {
    await ctx.reply('❌ Error. Please try again.');
  }
}

export async function handleSupport(ctx: Context) {
  const bannerUrl = `${process.env.WEBHOOK_URL}/uploads/banner.png`;
  const text = 
    `📞 <b>Customer Support</b>\n\n` +
    `Need help? Our agents are available 24/7 to assist you with deposits, withdrawals, or game rules.\n\n` +
    `💬 Contact us here: <b>@bunabingosupport</b>`;

  await ctx.replyWithPhoto(bannerUrl, {
    caption: text,
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.webApp('🆘 Open Support', `${config.bot.miniAppUrl}/support`)],
    ]),
  }).catch(() => {
    return ctx.reply(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🆘 Open Support', `${config.bot.miniAppUrl}/support`)],
      ]),
    });
  });
}
