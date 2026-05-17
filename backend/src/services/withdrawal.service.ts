import prisma from '../lib/prisma';
import { debitWallet } from './wallet.service';
import { triggerAdminEvent, triggerUserEvent } from '../lib/pusher';
import { logger } from '../lib/logger';
import { notifyAgent, notifyUser } from '../bot/notifier';
import { Decimal } from '@prisma/client/runtime/library';
import { Markup } from 'telegraf';

import { config } from '../config';

export async function createWithdrawalRequest(
  userId: string,
  amount: number,
  bankName: string,
  accountNumber: string,
  accountName: string
) {
  if (amount < config.withdrawal.minAmount) throw new Error(`Minimum withdrawal is ${config.withdrawal.minAmount} ETB`);

  // Check balance first
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet || new Decimal(wallet.balance.toString()).lessThan(amount)) {
    throw new Error('Insufficient balance');
  }

  // ─── Withdrawal Guard: Must play 5+ games AND win at least 1 game ───
  const [gamesPlayed, winsCount] = await Promise.all([
    prisma.ticket.groupBy({ where: { userId }, by: ['gameId'] }),
    prisma.winner.count({ where: { userId } })
  ]);

  if (gamesPlayed.length < 5) {
    throw new Error(`Anti-Abuse: You must play at least 5 games before requesting a withdrawal. You have played ${gamesPlayed.length} games.`);
  }

  if (winsCount < 1) {
    throw new Error(`Restricted: You must win at least 1 game (Row, Column, or Full House) before you can request a withdrawal. Keep playing to win! 🎰`);
  }

  const withdrawal = await prisma.withdrawal.create({
    data: {
      userId,
      amount,
      bankName,
      accountNumber,
      accountName,
      status: 'pending',
    },
    include: { user: { select: { username: true, referredBy: true } } },
  });

  // Deduct from wallet immediately to prevent double-spending
  await debitWallet(userId, amount, 'WITHDRAWAL', withdrawal.id, `Withdrawal request: ${bankName}`);

  // Notify Agent if applicable
  if (withdrawal.user?.referredBy) {
    const agent = await prisma.user.findUnique({
      where: { id: withdrawal.user.referredBy },
      select: { role: true, id: true, firstName: true }
    });

    if (agent && (agent.role === 'AGENT' || agent.role === 'ADMIN')) {
      const agentMsg = 
        `💸 <b>አዲስ የገንዘብ ማውጫ ጥያቄ (New Withdrawal)</b>\n\n` +
        `👤 <b>ተጫዋች (Player):</b> ${withdrawal.user?.username || 'Unknown'}\n` +
        `💰 <b>መጠን (Amount):</b> ${amount} ETB\n` +
        `🏦 <b>ባንክ (Bank):</b> ${bankName}\n` +
        `💳 <b>ሂሳብ (Account):</b> ${accountNumber}\n` +
        `👤 <b>ስም (Holder):</b> ${accountName}\n\n` +
        `እባክዎ መረጃውን አረጋግጠው ይክፈሉ ወይም ውድቅ ያድርጉ።`;

      const agentButtons = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Approve', `approve_wd_${withdrawal.id}`),
          Markup.button.callback('❌ Reject',  `reject_wd_${withdrawal.id}`),
        ],
      ]);

      await notifyAgent(agent.id, agentMsg, agentButtons);
    } else {
      // Fallback: Notify main admins if no valid agent is found
      await triggerAdminEvent('new-withdrawal', {
        withdrawalId: withdrawal.id,
        userId,
        amount,
        userName: withdrawal.user?.username || 'User',
        bankName,
        accountNumber,
      });
    }
  } else {
    // No referrer: Notify main admins
    await triggerAdminEvent('new-withdrawal', {
      withdrawalId: withdrawal.id,
      userId,
      amount,
      userName: (withdrawal as any).user?.username || 'User',
      bankName,
      accountNumber,
    });
  }

  logger.info(`Withdrawal request: user ${userId}, amount ${amount}, bank ${bankName}`);
  return withdrawal;
}

export async function approveWithdrawal(withdrawalId: string, adminId: string) {
  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
  if (!withdrawal) throw new Error('Withdrawal not found');
  if (withdrawal.status !== 'pending') throw new Error('Withdrawal already processed');

  await prisma.withdrawal.update({
    where: { id: withdrawalId },
    data: { status: 'approved' },
  });

  if (withdrawal.userId) {
    // Already debited on creation, just log the approval
    await prisma.adminLog.create({
      data: { adminId: adminId, targetUserId: withdrawal.userId, action: 'APPROVE_WITHDRAWAL', details: { withdrawalId, amount: withdrawal.amount } },
    });

    await triggerUserEvent(withdrawal.userId, 'withdrawal-approved', {
      withdrawalId,
      amount: withdrawal.amount.toString(),
    });

    // Notify User on Telegram
    await notifyUser(
      withdrawal.userId,
      `✅ <b>የገንዘብ ማውጫ ጥያቄዎ ተረጋግጧል! (Withdrawal Approved)</b>\n\n` +
      `💵 መጠን (Amount): <b>${Number(withdrawal.amount).toFixed(2)} ETB</b>\n` +
      `🏦 ባንክ (Bank): ${withdrawal.bankName}\n\n` +
      `ክፍያው ተፈጽሟል። ስላሸነፉ እንኳን ደስ አለዎት! 🏆`
    );
  }

  logger.info(`Withdrawal approved: ${withdrawalId} by admin ${adminId}`);
}

export async function rejectWithdrawal(withdrawalId: string, adminId: string, reason: string) {
  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
  if (!withdrawal) throw new Error('Withdrawal not found');
  if (withdrawal.status !== 'pending') throw new Error('Withdrawal already processed');

  await prisma.withdrawal.update({
    where: { id: withdrawalId },
    data: { status: 'rejected' },
  });

  if (withdrawal.userId) {
    // Refund the amount
    const { creditWallet } = await import('./wallet.service');
    await creditWallet(withdrawal.userId, withdrawal.amount, 'REFUND', withdrawalId, `Withdrawal rejected: ${reason}`);

    await prisma.adminLog.create({
      data: { adminId: adminId, targetUserId: withdrawal.userId, action: 'REJECT_WITHDRAWAL', details: { withdrawalId, reason } },
    });

    await triggerUserEvent(withdrawal.userId, 'withdrawal-rejected', { withdrawalId, reason });

    // Notify User on Telegram
    await notifyUser(
      withdrawal.userId,
      `❌ <b>የገንዘብ ማውጫ ጥያቄዎ አልተሳካም (Withdrawal Rejected)</b>\n\n` +
      `💵 መጠን (Amount): <b>${Number(withdrawal.amount).toFixed(2)} ETB</b>\n` +
      `📝 ምክንያት (Reason): ${reason}\n\n` +
      `ያወጡት ብር ወደ ዋና ሂሳብዎ ተመልሷል። (The amount has been refunded to your main balance.) 🙏`
    );
  }

  logger.info(`Withdrawal rejected: ${withdrawalId} — ${reason}`);
}

export async function getPendingWithdrawals(agentId?: string) {
  const withdrawals = await prisma.withdrawal.findMany({
    where: { 
      status: 'pending',
      user: agentId ? { referredBy: agentId } : undefined
    },
    include: { 
      user: { 
        include: { 
          wallet: true 
        } 
      } 
    },
    orderBy: { createdAt: 'asc' },
  });

  // Calculate transaction-ledger-based trueBalance for each user (Real Balance Checker!)
  const enriched = await Promise.all(withdrawals.map(async (wd) => {
    if (!wd.user) return wd;

    // Sum all transactions by type
    const txSums = await prisma.transaction.groupBy({
      by: ['type'],
      where: { userId: wd.userId, status: 'completed' },
      _sum: { amount: true }
    });

    const sums: Record<string, number> = {};
    txSums.forEach(group => {
      sums[group.type] = Number(group._sum.amount || 0);
    });

    // True Balance = (Deposits + Prize Wins + Refunds + Referral Commissions + Referral Bonuses) - (Withdrawals + Ticket Purchases)
    const deposits = sums['DEPOSIT'] || 0;
    const wins = sums['PRIZE_WIN'] || 0;
    const refunds = sums['REFUND'] || 0;
    const commissions = sums['REFERRAL_COMMISSION'] || 0;
    const bonuses = sums['REFERRAL_BONUS'] || 0;
    
    const spent = sums['TICKET_PURCHASE'] || 0;
    const withdrawn = sums['WITHDRAWAL'] || 0;

    const trueBalance = (deposits + wins + refunds + commissions + bonuses) - (spent + withdrawn);

    (wd.user as any).trueBalance = trueBalance;
    (wd.user as any).isBalanceLegit = Math.abs(trueBalance - Number(wd.user.wallet?.balance || 0)) < 0.01;

    return wd;
  }));

  return enriched;
}

export async function getUserWithdrawals(userId: string) {
  return prisma.withdrawal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

