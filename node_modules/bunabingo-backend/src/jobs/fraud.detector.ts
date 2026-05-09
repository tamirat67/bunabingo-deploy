import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import { triggerAdminEvent } from '../lib/pusher';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Fraud Detection Job
 * Runs on a schedule to detect suspicious activity patterns.
 */

const THRESHOLDS = {
  maxDepositsPerHour: 3,
  maxWithdrawalsPerDay: 2,
  largeWithdrawalAmount: 5000,
  suspiciousWinRate: 0.8,   // 80%+ win rate is suspicious
  minGamesForWinRateCheck: 10,
};

export async function runFraudDetection(): Promise<void> {
  logger.info('[Fraud] Running fraud detection scan...');

  await Promise.all([
    checkMultipleDeposits(),
    checkSuspiciousWithdrawals(),
    checkHighWinRate(),
    checkLargeWithdrawals(),
  ]);

  logger.info('[Fraud] Scan complete.');
}

async function checkMultipleDeposits(): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const suspicious = await prisma.deposit.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: oneHourAgo }, status: 'PENDING' },
    _count: { id: true },
    having: { id: { _count: { gt: THRESHOLDS.maxDepositsPerHour } } },
  });

  for (const s of suspicious) {
    const user = await prisma.user.findUnique({ where: { id: s.userId } });
    const msg = `⚠️ FRAUD ALERT: User ${user?.firstName} (${user?.telegramId}) submitted ${s._count.id} deposit requests in 1 hour`;
    logger.warn(msg);
    await triggerAdminEvent('fraud-alert', { type: 'MULTIPLE_DEPOSITS', userId: s.userId, count: s._count.id, message: msg });
    await prisma.adminLog.create({ data: { adminId: s.userId, action: 'FRAUD_ALERT_MULTIPLE_DEPOSITS', details: { count: s._count.id } } });
  }
}

async function checkSuspiciousWithdrawals(): Promise<void> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const suspicious = await prisma.withdrawal.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: oneDayAgo } },
    _count: { id: true },
    having: { id: { _count: { gt: THRESHOLDS.maxWithdrawalsPerDay } } },
  });

  for (const s of suspicious) {
    const user = await prisma.user.findUnique({ where: { id: s.userId } });
    const msg = `⚠️ FRAUD ALERT: User ${user?.firstName} made ${s._count.id} withdrawal requests in 24h`;
    logger.warn(msg);
    await triggerAdminEvent('fraud-alert', { type: 'MULTIPLE_WITHDRAWALS', userId: s.userId, count: s._count.id, message: msg });
  }
}

async function checkHighWinRate(): Promise<void> {
  const users = await prisma.user.findMany({
    include: {
      tickets: { where: { game: { status: 'FINISHED' } } },
      winners: true,
    },
  });

  for (const user of users) {
    const totalGames = user.tickets.length;
    if (totalGames < THRESHOLDS.minGamesForWinRateCheck) continue;

    const winRate = user.winners.length / totalGames;
    if (winRate > THRESHOLDS.suspiciousWinRate) {
      const msg = `⚠️ FRAUD ALERT: User ${user.firstName} has ${(winRate * 100).toFixed(0)}% win rate over ${totalGames} games`;
      logger.warn(msg);
      await triggerAdminEvent('fraud-alert', {
        type: 'HIGH_WIN_RATE',
        userId: user.id,
        winRate: (winRate * 100).toFixed(1),
        totalGames,
        message: msg,
      });
    }
  }
}

async function checkLargeWithdrawals(): Promise<void> {
  const pending = await prisma.withdrawal.findMany({
    where: {
      status: 'PENDING',
      amount: { gt: THRESHOLDS.largeWithdrawalAmount },
    },
    include: { user: true },
  });

  for (const w of pending) {
    const msg = `⚠️ LARGE WITHDRAWAL: ${w.user.firstName} requested ${Number(w.amount).toFixed(2)} ETB`;
    logger.warn(msg);
    await triggerAdminEvent('fraud-alert', {
      type: 'LARGE_WITHDRAWAL',
      userId: w.userId,
      amount: w.amount,
      message: msg,
    });
  }
}
