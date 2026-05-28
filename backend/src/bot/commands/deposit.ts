import { Context, Markup } from 'telegraf';
import { getUserByTelegramId } from '../../services/user.service';
import { config } from '../../config';
import { handleDepositManualStart } from './depositFlow';

/**
 * handleDeposit now skips the selection menu and starts the manual deposit flow directly.
 * "Telegram Stars" has been safely removed as requested.
 */
export async function handleDeposit(ctx: Context) {
  const tgUser = ctx.from!;

  try {
    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.reply('❌ እባክዎ አስቀድመው /start ን በመጫን ይመዝገቡ።');

    if (ctx.callbackQuery) await ctx.answerCbQuery();

    // Directly trigger manual deposit flow
    await handleDepositManualStart(ctx);
  } catch (err) {
    console.error('Deposit command error:', err);
    await ctx.reply('❌ ችግር አጋጥሟል፣ እባክዎ እንደገና ይሞክሩ።');
  }
}

// Keeping handleDepositManual for callback compatibility if needed
export async function handleDepositManual(ctx: Context) {
  await handleDepositManualStart(ctx);
}
