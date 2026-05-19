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
    if (!user) return ctx.reply('❌ እባክዎ አስቀድመው /start ን በመጫን ይመዝገቡ።');

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
          let typeAmh = t.type;
          if (t.type === 'DEPOSIT') typeAmh = 'ገቢ የተደረገ';
          else if (t.type === 'WITHDRAW') typeAmh = 'ወጪ የተደረገ';
          else if (t.type === 'PRIZE_WIN') typeAmh = 'ያሸነፉት ሽልማት';
          else if (t.type === 'REFUND') typeAmh = 'ተመላሽ የተደረገ';
          else if (t.type === 'REFERRAL_BONUS') typeAmh = 'የግብዣ ቦነስ';
          else if (t.type === 'GAME_JOIN') typeAmh = 'ለጨዋታ የተከፈለ';
          
          return `${sign} <code>${Number(t.amount).toFixed(2)}</code> - ${typeAmh} (${t.createdAt.toLocaleDateString()})`;
        }).join('\n')
      : '<i>ምንም እንቅስቃሴ አልተገኘም</i>';

    const phoneDisplay = user.phone
      ? `📱 ${user.phone}  ✅ <b>የተረጋገጠ</b>`
      : `📱 <i>ስልክ አልተያያዘም</i>`;

    const fullName = escapeHtml(`${user.firstName || ''}${user.lastName ? ` ${user.lastName}` : ''}`);

    await ctx.reply(
      `💳 <b>የእኔ ሂሳብ (MY WALLET)</b>\n\n` +
      `👤 <b>የሂሳብ ባለቤት፡</b> ${fullName}\n` +
      `${phoneDisplay}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💵 <b>ዋና ሂሳብ (ሊወጣ የሚችል)፡</b> <code>${Number(wallet.balance).toFixed(2)} ETB</code>\n` +
      `🎁 <b>የቦነስ ሂሳብ (ለጨዋታ ብቻ / Non-withdrawable)፡</b> <code>${Number(wallet.bonusBalance).toFixed(2)} ETB</code>\n` +
      `💎 <b>የ XP ሳንቲሞች፡</b> <code>${wallet.coins} XP</code>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `📜 <b>የቅርብ ጊዜ የሂሳብ እንቅስቃሴዎች፡</b>\n${txList}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📥 ጠቅላላ ገቢ የተደረገው፡ <code>${Number(wallet.totalDeposited).toFixed(2)} ETB</code>\n` +
      `🏆 ጠቅላላ ያሸነፉት፡       <code>${Number(wallet.totalWon).toFixed(2)} ETB</code>\n` +
      `📤 ጠቅላላ ወጪ የወጣው፡ <code>${Number(wallet.totalWithdrawn).toFixed(2)} ETB</code>`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error('Error in handleBalance:', err);
    await ctx.reply('❌ የሂሳብዎን መጠን ማምጣት አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
  }
}
