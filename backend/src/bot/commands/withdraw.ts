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
  let supportHandle = '@Luel1616';

  if (ctx.from?.id) {
    const user = await getUserByTelegramId(ctx.from.id);
    if (user?.referrer?.telegramUsername) {
      supportHandle = `@${user.referrer.telegramUsername}`;
    } else if (user?.referrer?.phone) {
      supportHandle = `ስልክ: ${user.referrer.phone}`;
    }
  }

  const text = 
    `📞 <b>የደንበኞች አገልግሎት እና ድጋፍ</b>\n\n` +
    `እርዳታ ይፈልጋሉ? የእኛ የድጋፍ ሰጪዎች ስለ ብር ገቢ፣ ወጪ ወይም ስለ ጨዋታ ህጎች እርስዎን ለመርዳት 24/7 ዝግጁ ናቸው።\n\n` +
    `💬 እዚህ ያግኙን፡ <b>${supportHandle}</b>`;

  const buttons = [];
  if (supportHandle.startsWith('@')) {
    buttons.push([Markup.button.url('🆘 ድጋፍ ሰጪ ያግኙ', `https://t.me/${supportHandle.substring(1)}`)]);
  } else {
    buttons.push([Markup.button.webApp('🆘 ድጋፍ ሰጪ ያግኙ', `${config.bot.miniAppUrl}/support`)]);
  }

  await ctx.replyWithPhoto(bannerUrl, {
    caption: text,
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(buttons),
  }).catch(() => {
    return ctx.reply(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons),
    });
  });
}
