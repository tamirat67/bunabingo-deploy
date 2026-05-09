import prisma from '../lib/prisma';
import { creditWallet } from './wallet.service';
import { triggerAdminEvent, triggerUserEvent } from '../lib/pusher';
import { logger } from '../lib/logger';

export async function createDepositRequest(
  userId: string,
  amount: number,
  reference?: string,
  screenshotUrl?: string
) {
  if (amount <= 0) throw new Error('Deposit amount must be positive');

  const deposit = await prisma.deposit.create({
    data: { userId, amount, reference, screenshotUrl, status: 'PENDING' },
    include: { user: { select: { firstName: true, telegramUsername: true } } },
  });

  await triggerAdminEvent('new-deposit', {
    depositId: deposit.id,
    userId,
    amount,
    userName: deposit.user.firstName,
    reference,
  });

  logger.info(`Deposit request: user ${userId}, amount ${amount}, ref ${reference}`);
  return deposit;
}

export async function approveDeposit(depositId: string, adminId: string) {
  const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
  if (!deposit) throw new Error('Deposit not found');
  if (deposit.status !== 'PENDING') throw new Error('Deposit already processed');

  await prisma.deposit.update({
    where: { id: depositId },
    data: { status: 'APPROVED', approvedBy: adminId, approvedAt: new Date() },
  });

  await creditWallet(deposit.userId, deposit.amount, 'DEPOSIT', depositId, 'Deposit approved');

  await prisma.adminLog.create({
    data: { adminId, targetUserId: deposit.userId, action: 'APPROVE_DEPOSIT', details: { depositId, amount: deposit.amount } },
  });

  await triggerUserEvent(deposit.userId, 'deposit-approved', {
    depositId,
    amount: deposit.amount.toString(),
  });

  logger.info(`Deposit approved: ${depositId} by admin ${adminId}`);
}

export async function rejectDeposit(depositId: string, adminId: string, reason: string) {
  const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
  if (!deposit) throw new Error('Deposit not found');
  if (deposit.status !== 'PENDING') throw new Error('Deposit already processed');

  await prisma.deposit.update({
    where: { id: depositId },
    data: { status: 'REJECTED', adminNote: reason, approvedBy: adminId, approvedAt: new Date() },
  });

  await prisma.adminLog.create({
    data: { adminId, targetUserId: deposit.userId, action: 'REJECT_DEPOSIT', details: { depositId, reason } },
  });

  await triggerUserEvent(deposit.userId, 'deposit-rejected', { depositId, reason });
  logger.info(`Deposit rejected: ${depositId} — ${reason}`);
}

export async function getPendingDeposits() {
  return prisma.deposit.findMany({
    where: { status: 'PENDING' },
    include: { user: { select: { firstName: true, telegramUsername: true, telegramId: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getUserDeposits(userId: string) {
  return prisma.deposit.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}
