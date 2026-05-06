import { Context, Markup } from 'telegraf';
import { findOrCreateUser } from '../../services/user.service';
import { getOrCreateWallet } from '../../services/wallet.service';
import { config } from '../../config';

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
    const greeting = isNewUser ? '🎉 Welcome to BunaBingo!' : `👋 Welcome back, ${user.firstName}!`;

    await ctx.reply(
      `${greeting}\n\n` +
      `🎰 *BunaBingo* — Fully Automated Bingo Platform\n\n` +
      `🎮 Games start automatically when players join\n` +
      `💰 Win instantly — prizes sent to your wallet\n` +
      `🔐 Secure · Fair · 100% Automated\n\n` +
      `Use the buttons below or open the Mini App 👇`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 Open Mini App', config.bot.miniAppUrl)],
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
  } catch (err: any) {
    logger.error('Error in handleStart:', err);
    await ctx.reply('❌ Something went wrong. Please try again.');
  }
}
