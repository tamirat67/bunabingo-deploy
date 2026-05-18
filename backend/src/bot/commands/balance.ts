import { Context } from 'telegraf';
import { getUserByTelegramId } from '../../services/user.service';
import { getOrCreateWallet } from '../../services/wallet.service';
import prisma from '../../lib/prisma';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function handleBalance(ctx: Context) {
  const tgUser = ctx.from!;

  try {
    const user = await getUserByTelegramId(tgUser.id);
    if (!user) return ctx.reply('❌ Please /start first to register.');

    if (ctx.callbackQuery) await ctx.answerCbQuery();
    const [wallet, lastTransactions] = await Promise.all([
      getOrCreateWallet(user.id),
      prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    const txList = lastTransactions.length > 0
      ? lastTransactions.map(t => {
          const sign = ['DEPOSIT', 'PRIZE_WIN', 'REFUND', 'REFERRAL_BONUS'].includes(t.type) ? '➕' : '➖';
          return `${sign} <code>${Number(t.amount).toFixed(2)}</code> - ${t.type} (${t.createdAt.toLocaleDateString()})`;
        }).join('\n')
      : '<i>No transactions found</i>';

    const phoneDisplay = user.phone
      ? `📱 ${user.phone}  ✅ <b>VERIFIED</b>`
      : `📱 <i>No phone linked</i>`;

    const fullName = escapeHtml(`${user.firstName || ''}${user.lastName ? ` ${user.lastName}` : ''}`);

    await ctx.reply(
      `💳 <b>MY WALLET / የእኔ ሂሳብ</b>\n\n` +
      `👤 <b>Account Holder:</b> ${fullName}\n` +
      `${phoneDisplay}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💵 <b>Main Balance:</b> <code>${Number(wallet.balance).toFixed(2)} ETB</code>\n` +
      `🎁 <b>Bonus Balance:</b> <code>${Number(wallet.bonusBalance).toFixed(2)} ETB</code>\n` +
      `💎 <b>XP Coins:</b> <code>${wallet.coins} XP</code>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `📜 <b>Recent Transactions (የቅርብ ጊዜ እንቅስቃሴዎች):</b>\n${txList}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📥 Total Deposited: <code>${Number(wallet.totalDeposited).toFixed(2)} ETB</code>\n` +
      `🏆 Total Won:       <code>${Number(wallet.totalWon).toFixed(2)} ETB</code>\n` +
      `📤 Total Withdrawn: <code>${Number(wallet.totalWithdrawn).toFixed(2)} ETB</code>`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error('Error in handleBalance:', err);
    await ctx.reply('❌ Could not fetch balance. Try again.');
  }
}
