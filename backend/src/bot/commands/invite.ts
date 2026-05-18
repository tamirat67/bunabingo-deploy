import { Context, Markup } from 'telegraf';
import { getUserByTelegramId } from '../../services/user.service';
import { logger } from '../../lib/logger';

// ─── /invite ──────────────────────────────────────────────────────────────────
export async function handleInvite(ctx: Context) {
  const tgUser = ctx.from!;

  try {
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.reply('❌ እባክዎ አስቀድመው /start ን በመጫን ይመዝገቡ።');

    const botUsername  = 'buna_bingobot';
    const inviteLink   = `https://t.me/${botUsername}?start=${user.id}`;
    const shareMessage = encodeURIComponent(
      `🎰 ቡና ቢንጎ ላይ አብረን እንጫወት! ☕️ ሁለታችንም የ 5 ብር ቦነስ እናገኛለን!\n\n`
    );
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${shareMessage}`;

    logger.info(`[Invite] User ${tgUser.id} requested invite link`);

    const bannerUrl = `${process.env.WEBHOOK_URL}/uploads/banner.png`;
    const messageText = 
      `✉️ <b><a href="${shareUrl}">ጓደኞችዎን ይጋብዙ እና ይሸለሙ!</a></b> ☕️💰\n\n` +
      `"የቡና ጣዕም፣ ወርቃማ ድሎች።" 👑\n\n` +
      `🎁 <b>የምዝገባ ቦነስ፡</b> ለሚጋብዙት እያንዳንዱ ጓደኛዎ <b>5 ብር</b> ያግኙ!\n` +
      `💸 <b>የህይወት ዘመን ኮሚሽን፡</b> ጓደኞችዎ በሚገዙት እያንዳንዱ የጨዋታ ቲኬት <b>2%</b> ኮሚሽን ያግኙ — <i>ለዘላለም!</i>\n\n` +
      `🔗 <b>የእርስዎ የግብዣ ሊንክ፡</b>\n` +
      `<a href="${inviteLink}">${inviteLink}</a>\n\n` +
      `👥 የጋበዟቸው ጓደኞች፡ <b>${user._count?.referrals || 0}</b>\n` +
      `💰 ጠቅላላ የኮሚሽን መጠን፡ <b>${Number(user.wallet?.referralBalance || 0).toFixed(2)} ETB</b>\n\n` +
      `✨ <i>ተጨማሪ ጓደኞችን በመጋበዝ ገቢዎን ያሳድጉ!</i>`;

    await ctx.replyWithPhoto(bannerUrl, {
      caption: messageText,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.url('📤 የግብዣ ሊንክ ያጋሩ', shareUrl)],
        [Markup.button.callback('📊 ሂሳብ ይመልከቱ', 'cmd_balance')],
      ]),
    }).catch(() => {
      // Fallback
      return ctx.reply(messageText, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.url('📤 የግብዣ ሊንክ ያጋሩ', shareUrl)],
          [Markup.button.callback('📊 ሂሳብ ይመልከቱ', 'cmd_balance')],
        ]),
      });
    });
  } catch (err: any) {
    logger.error('[Invite] Error:', err);
    await ctx.reply('❌ የግብዣ ሊንክ ማመንጨት አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
  }
}
