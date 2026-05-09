"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDepositRequest = createDepositRequest;
exports.approveDeposit = approveDeposit;
exports.rejectDeposit = rejectDeposit;
exports.getPendingDeposits = getPendingDeposits;
exports.getUserDeposits = getUserDeposits;
const prisma_1 = __importDefault(require("../lib/prisma"));
const wallet_service_1 = require("./wallet.service");
const pusher_1 = require("../lib/pusher");
const logger_1 = require("../lib/logger");
async function createDepositRequest(userId, amount, reference, screenshotUrl) {
    if (amount <= 0)
        throw new Error('Deposit amount must be positive');
    const deposit = await prisma_1.default.deposit.create({
        data: {
            userId,
            amount,
            reference: reference || `DEP-${Date.now()}`,
            receiptUrl: screenshotUrl,
            status: 'PENDING',
        },
        include: { user: { select: { firstName: true, username: true } } },
    });
    await (0, pusher_1.triggerAdminEvent)('new-deposit', {
        depositId: deposit.id,
        userId,
        amount,
        userName: deposit.user?.firstName || 'User',
        reference,
    });
    logger_1.logger.info(`Deposit request: user ${userId}, amount ${amount}, ref ${reference}`);
    return deposit;
}
async function approveDeposit(depositId, adminId) {
    const deposit = await prisma_1.default.deposit.findUnique({ where: { id: depositId } });
    if (!deposit)
        throw new Error('Deposit not found');
    if (deposit.status !== 'PENDING')
        throw new Error('Deposit already processed');
    await prisma_1.default.deposit.update({
        where: { id: depositId },
        data: { status: 'APPROVED' },
    });
    await (0, wallet_service_1.creditWallet)(deposit.userId, deposit.amount, 'DEPOSIT', depositId, 'Deposit approved');
    await prisma_1.default.adminLog.create({
        data: {
            adminId,
            targetUserId: deposit.userId,
            action: 'APPROVE_DEPOSIT',
            details: { depositId, amount: deposit.amount },
        },
    });
    await (0, pusher_1.triggerUserEvent)(deposit.userId, 'deposit-approved', {
        depositId,
        amount: deposit.amount.toString(),
    });
    logger_1.logger.info(`Deposit approved: ${depositId} by admin ${adminId}`);
}
async function rejectDeposit(depositId, adminId, reason) {
    const deposit = await prisma_1.default.deposit.findUnique({ where: { id: depositId } });
    if (!deposit)
        throw new Error('Deposit not found');
    if (deposit.status !== 'PENDING')
        throw new Error('Deposit already processed');
    await prisma_1.default.deposit.update({
        where: { id: depositId },
        data: { status: 'REJECTED', details: reason },
    });
    await prisma_1.default.adminLog.create({
        data: {
            adminId,
            targetUserId: deposit.userId,
            action: 'REJECT_DEPOSIT',
            details: { depositId, reason },
        },
    });
    await (0, pusher_1.triggerUserEvent)(deposit.userId, 'deposit-rejected', { depositId, reason });
    logger_1.logger.info(`Deposit rejected: ${depositId} — ${reason}`);
}
async function getPendingDeposits() {
    return prisma_1.default.deposit.findMany({
        where: { status: 'PENDING' },
        include: { user: { select: { firstName: true, username: true, telegramId: true } } },
        orderBy: { createdAt: 'asc' },
    });
}
async function getUserDeposits(userId) {
    return prisma_1.default.deposit.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
    });
}
//# sourceMappingURL=deposit.service.js.map