import { Context, Markup } from 'telegraf';
import { getUserByTelegramId } from '../../services/user.service';
import { generateMagicLink } from '../../lib/magicLink';
import { config } from '../../config';
import { logger } from '../../lib/logger';

/**
 * Handles the "🌐 Open in Chrome" button.
 * Generates a one-time secure magic link and sends it as an external URL button.
 * The link auto-logs the user into the game in their browser — no typing required.
 */
export async function handleOpenInChrome(ctx: Context) {
  const tgUser = ctx.from!;

  try {
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    const user = await getUserByTelegramId(tgUser.id);

    if (!user || !user.phone) {
      return ctx.reply(
        '❌ ጨዋታ ለመጫወት መጀመሪያ ይመዝገቡ።\n\n' +
        'ምዝገባ ለማጠናቀቅ /register ይጠቀሙ።',
        { parse_mode: 'HTML' }
      );
    }

    // Generate a fresh, secure magic link (valid for 1 hour)
    const magicLink = generateMagicLink(user.telegramId, config.bot.miniAppUrl, 3600);

    logger.info(`[OpenInChrome] Generated magic link for user ${user.id}`);

    await ctx.reply(
      `🎮 <b>ጨዋታ ክፈት!</b>\n\n` +
      `ከታች ያለውን ቁልፍ ጫን ጨዋታው ወዲያውኑ ይከፈታል! 🚀\n\n` +
      `<i>(ይህ ሊንክ ለ1 ሰዓት ብቻ ይሠራል)</i>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.url('🌐 Open Game / ጨዋታ ክፈት', magicLink)],
        ]),
      }
    );
  } catch (err) {
    logger.error('[OpenInChrome] Error:', err);
    await ctx.reply('❌ ሊንኩ ሊፈጠር አልቻለም። እባክዎ እንደገና ይሞክሩ።');
  }
}
