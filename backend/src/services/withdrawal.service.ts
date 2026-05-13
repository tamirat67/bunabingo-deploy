import prisma from '../lib/prisma';
import { debitWallet } from './wallet.service';
import { triggerAdminEvent, triggerUserEvent } from '../lib/pusher';
import { logger } from '../lib/logger';
import { notifyAgent } from '../bot/notifier';
import { Decimal } from '@prisma/client/runtime/library';

export async function createWithdrawalRequest(
  userId: string,
  amount: number,
  bankName: string,
  accountNumber: string,
  accountName: string
) {
  if (amount < 25) throw new Error('Minimum withdrawal is 25 ETB');

  // Check balance first
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet || new Decimal(wallet.balance.toString()).lessThan(amount)) {
    throw new Error('Insufficient balance');
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

  // Notify Admin
  await triggerAdminEvent('new-withdrawal', {
    withdrawalId: withdrawal.id,
    userId,
    amount,
    userName: withdrawal.user?.username || 'User',
    bankName,
    accountNumber,
  });

  // Notify Agent if applicable
  if (withdrawal.user?.referredBy) {
    await triggerUserEvent(withdrawal.user.referredBy, 'agent-new-withdrawal', {
      withdrawalId: withdrawal.id,
      userId,
      amount,
      userName: withdrawal.user?.username || 'User',
    });

    // Notify agent on Telegram
    await notifyAgent(
      withdrawal.user.referredBy,
      `💸 <b>New Withdrawal Request</b>\n\n` +
      `👤 <b>Player:</b> ${withdrawal.user?.username || 'Unknown'}\n` +
      `💰 <b>Amount:</b> ${amount} ETB\n` +
      `🏦 <b>Bank:</b> ${bankName}\n` +
      `💳 <b>Account:</b> ${accountNumber}\n\n` +
      `Please check your agent portal to approve/reject.`
    );
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
    await debitWallet(withdrawal.userId, withdrawal.amount, 'WITHDRAWAL', withdrawalId, 'Withdrawal approved');

    await prisma.adminLog.create({
      data: { adminId: adminId, targetUserId: withdrawal.userId, action: 'APPROVE_WITHDRAWAL', details: { withdrawalId, amount: withdrawal.amount } },
    });

    await triggerUserEvent(withdrawal.userId, 'withdrawal-approved', {
      withdrawalId,
      amount: withdrawal.amount.toString(),
    });
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
    await prisma.adminLog.create({
      data: { adminId: adminId, targetUserId: withdrawal.userId, action: 'REJECT_WITHDRAWAL', details: { withdrawalId, reason } },
    });

    await triggerUserEvent(withdrawal.userId, 'withdrawal-rejected', { withdrawalId, reason });
  }

  logger.info(`Withdrawal rejected: ${withdrawalId} — ${reason}`);
}

export async function getPendingWithdrawals() {
  return prisma.withdrawal.findMany({
    where: { status: 'pending' },
    include: { user: { select: { username: true, telegramId: true, telegramUsername: true, firstName: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getUserWithdrawals(userId: string) {
  return prisma.withdrawal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

