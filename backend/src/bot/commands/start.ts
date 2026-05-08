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

    if (!user.phoneNumber) {
      logger.info(`[Bot] User ${tgUser.id} has no phone. Requesting contact...`);
      return ctx.reply(
        `👋 Welcome, <b>${tgUser.first_name}</b>!\n\nTo ensure a secure experience and prevent multiple accounts, please share your phone number to continue.`,
        {
          parse_mode: 'HTML',
          ...Markup.keyboard([
            [Markup.button.contactRequest('📱 Share Phone Number')]
          ]).oneTime().resize()
        }
      );
    }

    logger.info(`[Bot] Sending start message to ${tgUser.id} (${tgUser.first_name})`);
    
    await ctx.reply(
      `☕️ <b>Buna Bingo: Rich Flavor, Golden Wins.</b>\n` +
      `✨ <i>"The Perfect Blend of Luck and Luxury."</i>\n\n` +
      `👑 Sip, Play, Win: <b>The Royal Buna Way.</b>\n` +
      `☀️ Wake up to a <b>Jackpot</b> today!\n\n` +
      `Choose an option below to begin your journey:`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('Play Bingo 🎮', 'cmd_play_bingo'),
            Markup.button.callback('Play Spin 🎮', 'cmd_play_spin'),
          ],
          [
            Markup.button.webApp('Register 📝', config.bot.miniAppUrl),
            Markup.button.callback('Deposit 💵', 'cmd_deposit'),
          ],
          [
            Markup.button.callback('Check Balance 💰', 'cmd_balance'),
            Markup.button.callback('Contact support 📞', 'cmd_support'),
          ],
          [
            Markup.button.callback('Instruction 📖', 'cmd_instructions'),
            Markup.button.url('Invite ✉️', `https://t.me/share/url?url=${encodeURIComponent(config.bot.miniAppUrl)}&text=${encodeURIComponent('Join me on Buna Bingo! 🎰☕️')}`),
          ],
        ]),
      }
    );
    logger.info(`[Bot] Start message sent successfully to ${user.id}`);
  } catch (err: any) {
    logger.error('[Bot] FATAL ERROR in handleStart:', err);
    await ctx.reply('❌ Something went wrong. Please try again.');
  }
}
