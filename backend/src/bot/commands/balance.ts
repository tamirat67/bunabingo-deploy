import { Context } from 'telegraf';
import { getUserByTelegramId } from '../../services/user.service';
import { getOrCreateWallet } from '../../services/wallet.service';

export async function handleBalance(ctx: Context) {
  const tgUser = ctx.from!;

  try {
    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.reply('❌ Please /start first to register.');

    if (ctx.callbackQuery) await ctx.answerCbQuery();
    const wallet = await getOrCreateWallet(user.id);

    const phoneDisplay = user.phone
      ? `📱 ${user.phone}  ✅ *VERIFIED*`
      : `📱 _No phone linked_`;

    await ctx.reply(
      `💳 *MY WALLET*\n\n` +
      `👤 *Account Holder:* ${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}\n` +
      `${phoneDisplay}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💵 *Main Balance:* \`${Number(wallet.balance).toFixed(2)} ETB\`\n` +
      `🎁 *Bonus Balance:* \`${Number(wallet.bonusBalance).toFixed(2)} ETB\`\n` +
      `💎 *XP Coins:* \`${wallet.coins} XP\`\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `📥 Total Deposited: ${Number(wallet.totalDeposited).toFixed(2)} ETB\n` +
      `🏆 Total Won:       ${Number(wallet.totalWon).toFixed(2)} ETB\n` +
      `🎫 Total Spent:     ${Number(wallet.totalSpent).toFixed(2)} ETB\n` +
      `📤 Total Withdrawn: ${Number(wallet.totalWithdrawn).toFixed(2)} ETB`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    await ctx.reply('❌ Could not fetch balance. Try again.');
  }
}
