import prisma from '../lib/prisma';
import { creditWallet } from './wallet.service';
import { triggerAdminEvent, triggerUserEvent } from '../lib/pusher';
import { logger } from '../lib/logger';
import { notifyAgent } from '../bot/notifier';

export async function createDepositRequest(
  userId: string,
  amount: number,
  reference?: string,
  screenshotUrl?: string
) {
  if (amount <= 0) throw new Error('Deposit amount must be positive');

  const deposit = await prisma.deposit.create({
    data: { 
      userId, 
      amount, 
      txnId: reference || `DEP-${Date.now()}`, 
      receiptUrl: screenshotUrl, 
      status: 'pending' 
    },
    include: { user: { select: { username: true, referredBy: true } } },
  });

  // Notify Global Admin
  await triggerAdminEvent('new-deposit', {
    depositId: deposit.id,
    userId,
    amount,
    userName: deposit.user?.username || 'User',
    reference,
  });

  // If user has an agent (referredBy), notify that specific agent channel too
  if (deposit.user?.referredBy) {
    await triggerUserEvent(deposit.user.referredBy, 'agent-new-deposit', {
      depositId: deposit.id,
      userId,
      amount,
      userName: deposit.user?.username || 'User',
    });

    // Notify agent on Telegram
    await notifyAgent(
      deposit.user.referredBy,
      `🔔 <b>New Deposit Request</b>\n\n` +
      `👤 <b>Player:</b> ${deposit.user?.username || 'Unknown'}\n` +
      `💰 <b>Amount:</b> ${amount} ETB\n` +
      `🔖 <b>Ref:</b> ${reference || 'N/A'}\n\n` +
      `Please check your agent portal to approve/reject.`
    );
  }

  logger.info(`Deposit request: user ${userId}, amount ${amount}, ref ${reference}`);
  return deposit;
}

export async function approveDeposit(depositId: string, adminId: string) {
  const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
  if (!deposit) throw new Error('Deposit not found');
  if (deposit.status !== 'pending') throw new Error('Deposit already processed');

  await prisma.deposit.update({
    where: { id: depositId },
    data: { status: 'approved' }, 
  });

  if (deposit.userId) {
    await creditWallet(deposit.userId, deposit.amount, 'DEPOSIT', depositId, 'Deposit approved');

    // ─── 20% Deposit Bonus ───
    const { creditBonus } = await import('./wallet.service');
    const bonusAmount = Number(deposit.amount) * 0.2;
    await creditBonus(deposit.userId, bonusAmount, `Deposit bonus (20%) for request #${depositId}`);

    await prisma.adminLog.create({
      data: { adminId: adminId, targetUserId: deposit.userId, action: 'APPROVE_DEPOSIT', details: { depositId, amount: deposit.amount, bonus: bonusAmount } },
    });

    await triggerUserEvent(deposit.userId, 'deposit-approved', {
      depositId,
      amount: deposit.amount.toString(),
      bonus: bonusAmount.toFixed(2),
    });
  }

  logger.info(`Deposit approved: ${depositId} by admin/agent ${adminId}`);
}

export async function rejectDeposit(depositId: string, adminId: string, reason: string) {
  const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
  if (!deposit) throw new Error('Deposit not found');
  if (deposit.status !== 'pending') throw new Error('Deposit already processed');

  await prisma.deposit.update({
    where: { id: depositId },
    data: { status: 'rejected', details: reason },
  });

  if (deposit.userId) {
    await prisma.adminLog.create({
      data: { adminId: adminId, targetUserId: deposit.userId, action: 'REJECT_DEPOSIT', details: { depositId, reason } },
    });

    await triggerUserEvent(deposit.userId, 'deposit-rejected', { depositId, reason });
  }
  logger.info(`Deposit rejected: ${depositId} — ${reason}`);
}

export async function getPendingDeposits() {
  return prisma.deposit.findMany({
    where: { status: 'pending' },
    include: { user: { select: { username: true, telegramId: true, telegramUsername: true, firstName: true } } },
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

