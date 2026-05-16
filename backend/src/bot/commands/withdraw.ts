import { Context, Markup } from 'telegraf';
import { getUserByTelegramId } from '../../services/user.service';
import { createWithdrawalRequest } from '../../services/withdrawal.service';
import { config } from '../../config';

export async function handleWithdraw(ctx: Context) {
  const { handleWithdrawStart } = await import('./withdrawFlow');
  await handleWithdrawStart(ctx);
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
