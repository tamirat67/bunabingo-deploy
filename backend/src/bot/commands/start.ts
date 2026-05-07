import { Context, Markup } from 'telegraf';
import { findOrCreateUser } from '../../services/user.service';
import { getOrCreateWallet } from '../../services/wallet.service';
import { config } from '../../config';
import { logger } from '../../lib/logger';

export async function handleStart(ctx: Context) {
  const tgUser = ctx.from!;

  try {
    const user = await findOrCreateUser({
      id: tgUser.id,
      username: tgUser.username,
      first_name: tgUser.first_name,
      last_name: tgUser.last_name,
    });

    await getOrCreateWallet(user.id);

    const isNewUser = (Date.now() - user.registeredAt.getTime()) < 5000;
    const greeting = isNewUser ? '🏆 <b>Buna Bingo — Wake Up to a Jackpot!</b> ☀️' : `👑 <b>Welcome back to The Royal Buna Way, ${user.firstName}!</b>`;

    logger.info(`[Bot] Sending start message to ${user.id} (${user.firstName})`);
    
    await ctx.reply(
      `${greeting}\n\n` +
      `🎰 <b>Buna Bingo: Rich Flavor, Golden Wins.</b> ☕️💰\n\n` +
      `✨ <i>The Perfect Blend of Luck and Luxury.</i> ✨\n\n` +
      `🎮 Games start instantly when players join\n` +
      `💰 Win automatically — prizes sent to your wallet\n` +
      `🔐 Secure · Fair · 100% Automated\n\n` +
      `Sip, Play, Win: The Royal Buna Way! 👇`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 Open Mini App', config.bot.miniAppUrl)],
          [Markup.button.url('🔗 Direct Link (Fallback)', config.bot.miniAppUrl)],
          [
            Markup.button.callback('💰 Balance', 'cmd_balance'),
            Markup.button.callback('🎫 Buy Ticket', 'cmd_buy'),
          ],
          [
            Markup.button.callback('💳 Deposit', 'cmd_deposit'),
            Markup.button.callback('💸 Withdraw', 'cmd_withdraw'),
          ],
          [
            Markup.button.callback('🃏 My Cards', 'cmd_cards'),
            Markup.button.callback('📊 Results', 'cmd_results'),
          ],
          [Markup.button.callback('🆘 Support', 'cmd_support')],
        ]),
      }
    );
    logger.info(`[Bot] Start message sent successfully to ${user.id}`);
  } catch (err: any) {
    logger.error('[Bot] FATAL ERROR in handleStart:', err);
    await ctx.reply('❌ Something went wrong. Please try again.');
  }
}
