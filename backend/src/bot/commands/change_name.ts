import { Context, Markup } from 'telegraf';
import { Message } from 'telegraf/types';
import { getUserByTelegramId } from '../../services/user.service';
import { setSession, getSession, clearSession } from '../session';
import { logger } from '../../lib/logger';
import prisma from '../../lib/prisma';

// ─── /change_name ─────────────────────────────────────────────────────────────
export async function handleChangeName(ctx: Context) {
  const tgUser = ctx.from!;

  try {
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.reply('❌ እባክዎ አስቀድመው /start ን በመጫን ይመዝገቡ።');

    setSession(tgUser.id, { type: 'CHANGE_NAME', step: 'AWAITING_NAME' });

    await ctx.reply(
      `✏️ <b>ስም መቀየሪያ</b>\n\n` +
      `ያሁኑ ስም፦ <b>${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}</b>\n\n` +
      `እባክዎ አዲሱን ስምዎን ያስገቡ፦\n` +
      `<i>(ከ2 እስከ 32 ቁምፊዎች፣ ፊደላት እና ክፍተቶች ብቻ)</i>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ ሰርዝ', 'cmd_change_name_cancel')],
        ]),
      }
    );
  } catch (err: any) {
    logger.error('[ChangeName] Error:', err);
    await ctx.reply('❌ ችግር አጋጥሟል፣ እባክዎ እንደገና ይሞክሩ።');
  }
}

// ─── Cancel ───────────────────────────────────────────────────────────────────
export async function handleChangeNameCancel(ctx: Context) {
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  clearSession(ctx.from!.id);
  await ctx.reply('❌ ስም መቀየሩ ተሰርዟል።');
}

// ─── Message router ───────────────────────────────────────────────────────────
export async function handleChangeNameMessage(ctx: Context): Promise<boolean> {
  const tgUser = ctx.from!;
  const session = getSession(tgUser.id);
  if (!session || session.type !== 'CHANGE_NAME') return false;

  const msg = ctx.message as any;
  const newName = ((msg as Message.TextMessage)?.text ?? '').trim();

  // Validate
  if (!newName || newName.length < 2 || newName.length > 32) {
    await ctx.reply(
      '⚠️ ስም ከ2 እስከ 32 ቁምፊዎች መሆን አለበት። እባክዎ እንደገና ይሞክሩ።',
      { ...Markup.inlineKeyboard([[Markup.button.callback('❌ ሰርዝ', 'cmd_change_name_cancel')]]) }
    );
    return true;
  }

  if (!/^[\p{L}\p{M} '-]+$/u.test(newName)) {
    await ctx.reply(
      '⚠️ ስም ፊደላትን፣ ክፍተቶችን፣ ሰረዞችን እና ጭረቶችን ብቻ መያዝ ይችላል።',
      { ...Markup.inlineKeyboard([[Markup.button.callback('❌ ሰርዝ', 'cmd_change_name_cancel')]]) }
    );
    return true;
  }

  clearSession(tgUser.id);

  try {
    const [firstName, ...rest] = newName.split(' ');
    const lastName = rest.join(' ') || null;

    await prisma.user.update({
      where: { telegramId: BigInt(tgUser.id) },
      data: { firstName, lastName: lastName ?? undefined },
    });

    logger.info(`[ChangeName] User ${tgUser.id} changed name to "${newName}"`);

    await ctx.reply(
      `✅ <b>ስምዎ በተሳካ ሁኔታ ተቀይሯል!</b>\n\n` +
      `አዲሱ ስምዎ፦ <b>${newName}</b>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🏠 ወደ ዋና ማውጫ', 'cmd_start')],
        ]),
      }
    );
  } catch (err: any) {
    logger.error('[ChangeName] DB error:', err);
    await ctx.reply('❌ ስም መቀየር አልተሳካም። እባክዎ እንደገና ይሞክሩ።');
  }

  return true;
}
