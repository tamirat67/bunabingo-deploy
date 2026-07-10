import { Context } from 'telegraf';
import { getUserByTelegramId } from '../../services/user.service';
import prisma from '../../lib/prisma';
import bcrypt from 'bcrypt';
import { logger } from '../../lib/logger';

export async function handlePassword(ctx: Context) {
  const tgUser = ctx.from!;

  try {
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    const user = await getUserByTelegramId(tgUser.id);
    if (!user || !user.phone) {
      return ctx.reply('❌ እባክዎ መጀመሪያ ይመዝገቡና ስልክ ቁጥርዎን ያጋሩ። /register ይጠቀሙ።');
    }

    // Generate a new 10-character password
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let generatedPassword = '';
    for (let i = 0; i < 10; i++) {
      generatedPassword += chars[Math.floor(Math.random() * chars.length)];
    }

    const passwordHash = await bcrypt.hash(generatedPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });

    logger.info(`[Bot] Password generated for user ${tgUser.id}`);

    await ctx.reply(
      `🔑 <b>የእርስዎ አዲስ የይለፍ ቃል (Password)</b>\n\n` +
      `📱 ስልክ (Phone): <code>${user.phone}</code>\n` +
      `🔑 ይለፍ ቃል (Password): <code>${generatedPassword}</code>\n\n` +
      `⚠️ ይህንን የይለፍ ቃል ያስቀምጡ! በሌሎች ስልኮች ወይም ኮምፒውተሮች ላይ መግባት ሲፈልጉ ይጠቀሙበታል።\n\n` +
      `<i>(እንደገና የይለፍ ቃል ከጠየቁ፣ የድሮው አይሰራም)</i>`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    logger.error('[Password] Error:', err);
    await ctx.reply('❌ የይለፍ ቃል ማመንጨት አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
  }
}
