"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFraudDetection = runFraudDetection;
const prisma_1 = __importDefault(require("../lib/prisma"));
const logger_1 = require("../lib/logger");
const pusher_1 = require("../lib/pusher");
/**
 * Fraud Detection Job
 * Runs on a schedule to detect suspicious activity patterns.
 */
const THRESHOLDS = {
    maxDepositsPerHour: 3,
    maxWithdrawalsPerDay: 2,
    largeWithdrawalAmount: 5000,
    suspiciousWinRate: 0.8, // 80%+ win rate is suspicious
    minGamesForWinRateCheck: 10,
};
async function runFraudDetection() {
    logger_1.logger.info('[Fraud] Running fraud detection scan...');
    await Promise.all([
        checkMultipleDeposits(),
        checkSuspiciousWithdrawals(),
        checkHighWinRate(),
        checkLargeWithdrawals(),
    ]);
    logger_1.logger.info('[Fraud] Scan complete.');
}
async function checkMultipleDeposits() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const suspicious = await prisma_1.default.deposit.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: oneHourAgo }, status: 'PENDING' },
        _count: { id: true },
        having: { id: { _count: { gt: THRESHOLDS.maxDepositsPerHour } } },
    });
    for (const s of suspicious) {
        const user = await prisma_1.default.user.findUnique({ where: { id: s.userId } });
        const msg = `⚠️ FRAUD ALERT: User ${user?.firstName} (${user?.telegramId}) submitted ${s._count.id} deposit requests in 1 hour`;
        logger_1.logger.warn(msg);
        await (0, pusher_1.triggerAdminEvent)('fraud-alert', { type: 'MULTIPLE_DEPOSITS', userId: s.userId, count: s._count.id, message: msg });
        await prisma_1.default.adminLog.create({ data: { adminId: s.userId, action: 'FRAUD_ALERT_MULTIPLE_DEPOSITS', details: { count: s._count.id } } });
    }
}
async function checkSuspiciousWithdrawals() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const suspicious = await prisma_1.default.withdrawal.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: oneDayAgo } },
        _count: { id: true },
        having: { id: { _count: { gt: THRESHOLDS.maxWithdrawalsPerDay } } },
    });
    for (const s of suspicious) {
        const user = await prisma_1.default.user.findUnique({ where: { id: s.userId } });
        const msg = `⚠️ FRAUD ALERT: User ${user?.firstName} made ${s._count.id} withdrawal requests in 24h`;
        logger_1.logger.warn(msg);
        await (0, pusher_1.triggerAdminEvent)('fraud-alert', { type: 'MULTIPLE_WITHDRAWALS', userId: s.userId, count: s._count.id, message: msg });
    }
}
async function checkHighWinRate() {
    const users = await prisma_1.default.user.findMany({
        include: {
            tickets: { where: { game: { status: 'FINISHED' } } },
            winners: true,
        },
    });
    for (const user of users) {
        const totalGames = user.tickets.length;
        if (totalGames < THRESHOLDS.minGamesForWinRateCheck)
            continue;
        const winRate = user.winners.length / totalGames;
        if (winRate > THRESHOLDS.suspiciousWinRate) {
            const msg = `⚠️ FRAUD ALERT: User ${user.firstName} has ${(winRate * 100).toFixed(0)}% win rate over ${totalGames} games`;
            logger_1.logger.warn(msg);
            await (0, pusher_1.triggerAdminEvent)('fraud-alert', {
                type: 'HIGH_WIN_RATE',
                userId: user.id,
                winRate: (winRate * 100).toFixed(1),
                totalGames,
                message: msg,
            });
        }
    }
}
async function checkLargeWithdrawals() {
    const pending = await prisma_1.default.withdrawal.findMany({
        where: {
            status: 'PENDING',
            amount: { gt: THRESHOLDS.largeWithdrawalAmount },
        },
        include: { user: true },
    });
    for (const w of pending) {
        const msg = `⚠️ LARGE WITHDRAWAL: ${w.user.firstName} requested ${Number(w.amount).toFixed(2)} ETB`;
        logger_1.logger.warn(msg);
        await (0, pusher_1.triggerAdminEvent)('fraud-alert', {
            type: 'LARGE_WITHDRAWAL',
            userId: w.userId,
            amount: w.amount,
            message: msg,
        });
    }
}
//# sourceMappingURL=fraud.detector.js.map