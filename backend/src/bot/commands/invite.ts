import { Context, Markup } from 'telegraf';
import { getUserByTelegramId } from '../../services/user.service';
import { logger } from '../../lib/logger';
import { config } from '../../config';

// ─── /invite ──────────────────────────────────────────────────────────────────
export async function handleInvite(ctx: Context) {
  const tgUser = ctx.from!;

  try {
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.reply('❌ Please /start first to register.');

    const botUsername  = ctx.botInfo?.username ?? 'BunaBingoBot';
    const inviteLink   = `${config.bot.miniAppUrl}/invite/${user.id}`;
    const shareMessage = encodeURIComponent(
      `🎰 Join me on Buna Bingo! ☕️ We both get 5 ETB bonus!\n\n`
    );
    const shareUrl = `https://t.me/share/url?url=${inviteLink}&text=${shareMessage}`;

    logger.info(`[Invite] User ${tgUser.id} requested invite link`);

    const bannerUrl = `${process.env.WEBHOOK_URL}/uploads/banner.png`;
    const messageText = 
      `✉️ <b><a href="${shareUrl}">Invite Your Friends & Earn!</a></b> ☕️💰\n\n` +
      `"Spin Wheel, Play, Win: The Royal Buna Way." 👑\n\n` +
      `Share your personal invite link and earn <b>5 ETB bonus</b> for every friend who joins!\n\n`+
      `🔗 <b>Your invite link:</b>\n` +
      `<a href="${inviteLink}">${inviteLink}</a>\n\n` +
      `👥 Friends referred: <b>${user.referralCount}</b>\n` +
      `💰 Bonus earned: <b>${(user.referralCount * 5).toFixed(2)} ETB</b>\n\n` +
      `✨ <i>Invite more friends to grow your jackpot!</i>`;

    await ctx.replyWithPhoto(bannerUrl, {
      caption: messageText,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.url('📤 Share Invite Link', shareUrl)],
        [Markup.button.callback('📊 Check Balance', 'cmd_balance')],
      ]),
    }).catch(() => {
      // Fallback
      return ctx.reply(messageText, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.url('📤 Share Invite Link', shareUrl)],
          [Markup.button.callback('📊 Check Balance', 'cmd_balance')],
        ]),
      });
    });
  } catch (err: any) {
    logger.error('[Invite] Error:', err);
    await ctx.reply('❌ Could not generate invite link. Please try again.');
  }
}
