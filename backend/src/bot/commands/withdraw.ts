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
    `📞 <b>የደንበኞች አገልግሎት እና ድጋፍ</b>\n\n` +
    `እርዳታ ይፈልጋሉ? የእኛ የድጋፍ ሰጪዎች ስለ ብር ገቢ፣ ወጪ ወይም ስለ ጨዋታ ህጎች እርስዎን ለመርዳት 24/7 ዝግጁ ናቸው።\n\n` +
    `💬 እዚህ ያግኙን፡ <b>@Luel1616</b>`;

  await ctx.replyWithPhoto(bannerUrl, {
    caption: text,
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.webApp('🆘 ድጋፍ ሰጪ ያግኙ', `${config.bot.miniAppUrl}/support`)],
    ]),
  }).catch(() => {
    return ctx.reply(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🆘 ድጋፍ ሰጪ ያግኙ', `${config.bot.miniAppUrl}/support`)],
      ]),
    });
  });
}
