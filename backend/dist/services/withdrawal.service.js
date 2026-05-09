"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWithdrawalRequest = createWithdrawalRequest;
exports.approveWithdrawal = approveWithdrawal;
exports.rejectWithdrawal = rejectWithdrawal;
exports.getPendingWithdrawals = getPendingWithdrawals;
exports.getUserWithdrawals = getUserWithdrawals;
const prisma_1 = __importDefault(require("../lib/prisma"));
const logger_1 = require("../lib/logger");
const config_1 = require("../config");
const library_1 = require("@prisma/client/runtime/library");
const pusher_1 = require("../lib/pusher");
const wallet_service_1 = require("./wallet.service");
async function createWithdrawalRequest(userId, amount, accountName, accountNumber, bankName) {
    if (amount < config_1.config.withdrawal.minAmount) {
        throw new Error(`Minimum withdrawal is ${config_1.config.withdrawal.minAmount}`);
    }
    if (amount > config_1.config.withdrawal.maxAmount) {
        throw new Error(`Maximum withdrawal is ${config_1.config.withdrawal.maxAmount}`);
    }
    const wallet = await prisma_1.default.wallet.findUnique({ where: { userId } });
    if (!wallet)
        throw new Error('Wallet not found');
    if (new library_1.Decimal(wallet.balance.toString()).lessThan(amount)) {
        throw new Error('Insufficient balance');
    }
    const pending = await prisma_1.default.withdrawal.findFirst({
        where: { userId, status: 'PENDING' },
    });
    if (pending)
        throw new Error('You already have a pending withdrawal request');
    const withdrawal = await prisma_1.default.withdrawal.create({
        data: { userId, amount, accountName, accountNumber, bankName, status: 'PENDING' },
        include: { user: { select: { firstName: true, telegramUsername: true } } },
    });
    await (0, pusher_1.triggerAdminEvent)('new-withdrawal', {
        withdrawalId: withdrawal.id,
        userId,
        amount,
        userName: withdrawal.user.firstName,
        accountName,
        bankName,
    });
    logger_1.logger.info(`Withdrawal request: user ${userId}, amount ${amount}, bank ${bankName}`);
    return withdrawal;
}
async function approveWithdrawal(withdrawalId, adminId) {
    const withdrawal = await prisma_1.default.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal)
        throw new Error('Withdrawal not found');
    if (withdrawal.status !== 'PENDING')
        throw new Error('Withdrawal already processed');
    await (0, wallet_service_1.debitWallet)(withdrawal.userId, withdrawal.amount, 'WITHDRAWAL', withdrawalId, 'Withdrawal approved');
    await prisma_1.default.withdrawal.update({
        where: { id: withdrawalId },
        data: {
            status: 'COMPLETED',
            approvedBy: adminId,
            approvedAt: new Date(),
            processedAt: new Date(),
        },
    });
    await prisma_1.default.adminLog.create({
        data: {
            adminId,
            targetUserId: withdrawal.userId,
            action: 'APPROVE_WITHDRAWAL',
            details: { withdrawalId, amount: withdrawal.amount },
        },
    });
    await (0, pusher_1.triggerUserEvent)(withdrawal.userId, 'withdrawal-approved', {
        withdrawalId,
        amount: withdrawal.amount.toString(),
    });
    logger_1.logger.info(`Withdrawal approved: ${withdrawalId} by admin ${adminId}`);
}
async function rejectWithdrawal(withdrawalId, adminId, reason) {
    const withdrawal = await prisma_1.default.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal)
        throw new Error('Withdrawal not found');
    if (withdrawal.status !== 'PENDING')
        throw new Error('Withdrawal already processed');
    await prisma_1.default.withdrawal.update({
        where: { id: withdrawalId },
        data: {
            status: 'REJECTED',
            adminNote: reason,
            approvedBy: adminId,
            approvedAt: new Date(),
        },
    });
    await prisma_1.default.adminLog.create({
        data: {
            adminId,
            targetUserId: withdrawal.userId,
            action: 'REJECT_WITHDRAWAL',
            details: { withdrawalId, reason },
        },
    });
    await (0, pusher_1.triggerUserEvent)(withdrawal.userId, 'withdrawal-rejected', { withdrawalId, reason });
    logger_1.logger.info(`Withdrawal rejected: ${withdrawalId} — ${reason}`);
}
async function getPendingWithdrawals() {
    return prisma_1.default.withdrawal.findMany({
        where: { status: 'PENDING' },
        include: { user: { select: { firstName: true, telegramUsername: true, telegramId: true } } },
        orderBy: { createdAt: 'asc' },
    });
}
async function getUserWithdrawals(userId) {
    return prisma_1.default.withdrawal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
    });
}
//# sourceMappingURL=withdrawal.service.js.map