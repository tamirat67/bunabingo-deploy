import prisma from '../lib/prisma';
import { debitWallet } from './wallet.service';
import { triggerAdminEvent, triggerUserEvent } from '../lib/pusher';
import { logger } from '../lib/logger';
import { config } from '../config';
import { Decimal } from '@prisma/client/runtime/library';

export async function createWithdrawalRequest(
  userId: string,
  amount: number,
  accountName: string,
  accountNumber: string,
  bankName: string
) {
  if (amount < config.withdrawal.minAmount) {
    throw new Error(`Minimum withdrawal is ${config.withdrawal.minAmount}`);
  }
  if (amount > config.withdrawal.maxAmount) {
    throw new Error(`Maximum withdrawal is ${config.withdrawal.maxAmount}`);
  }

  // Check balance
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error('Wallet not found');
  if (new Decimal(wallet.balance.toString()).lessThan(amount)) {
    throw new Error('Insufficient balance');
  }

  // Check no pending withdrawal
  const pending = await prisma.withdrawal.findFirst({
    where: { userId, status: 'PENDING' },
  });
  if (pending) throw new Error('You already have a pending withdrawal request');

  const withdrawal = await prisma.withdrawal.create({
    data: { userId, amount, accountName, accountNumber, bankName, status: 'PENDING' },
    include: { user: { select: { firstName: true, telegramUsername: true } } },
  });

  await triggerAdminEvent('new-withdrawal', {
    withdrawalId: withdrawal.id,
    userId,
    amount,
    userName: withdrawal.user.firstName,
    accountName,
    bankName,
  });

  logger.info(`Withdrawal request: user ${userId}, amount ${amount}, bank ${bankName}`);
  return withdrawal;
}

export async function approveWithdrawal(withdrawalId: string, adminId: string) {
  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
  if (!withdrawal) throw new Error('Withdrawal not found');
  if (withdrawal.status !== 'PENDING') throw new Error('Withdrawal already processed');

  // Debit wallet
  await debitWallet(withdrawal.userId, withdrawal.amount, 'WITHDRAWAL', withdrawalId, 'Withdrawal approved');

  await prisma.withdrawal.update({
    where: { id: withdrawalId },
    data: { status: 'COMPLETED', approvedBy: adminId, approvedAt: new Date(), processedAt: new Date() },
  });

  await prisma.adminLog.create({
    data: {
      adminId,
      targetUserId: withdrawal.userId,
      action: 'APPROVE_WITHDRAWAL',
      details: { withdrawalId, amount: withdrawal.amount },
    },
  });

  await triggerUserEvent(withdrawal.userId, 'withdrawal-approved', {
    withdrawalId,
    amount: withdrawal.amount.toString(),
  });

  logger.info(`Withdrawal approved: ${withdrawalId} by admin ${adminId}`);
}

export async function rejectWithdrawal(withdrawalId: string, adminId: string, reason: string) {
  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
  if (!withdrawal) throw new Error('Withdrawal not found');
  if (withdrawal.status !== 'PENDING') throw new Error('Withdrawal already processed');

  await prisma.withdrawal.update({
    where: { id: withdrawalId },
    data: { status: 'REJECTED', adminNote: reason, approvedBy: adminId, approvedAt: new Date() },
  });

  await prisma.adminLog.create({
    data: { adminId, targetUserId: withdrawal.userId, action: 'REJECT_WITHDRAWAL', details: { withdrawalId, reason } },
  });

  await triggerUserEvent(withdrawal.userId, 'withdrawal-rejected', { withdrawalId, reason });
  logger.info(`Withdrawal rejected: ${withdrawalId} — ${reason}`);
}

export async function getPendingWithdrawals() {
  return prisma.withdrawal.findMany({
    where: { status: 'PENDING' },
    include: { user: { select: { firstName: true, telegramUsername: true, telegramId: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getUserWithdrawals(userId: string) {
  return prisma.withdrawal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}
