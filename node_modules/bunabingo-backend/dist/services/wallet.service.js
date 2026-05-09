"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateWallet = getOrCreateWallet;
exports.getBalance = getBalance;
exports.creditWallet = creditWallet;
exports.debitWallet = debitWallet;
const prisma_1 = __importDefault(require("../lib/prisma"));
const library_1 = require("@prisma/client/runtime/library");
const pusher_1 = require("../lib/pusher");
async function getOrCreateWallet(userId) {
    return prisma_1.default.wallet.upsert({
        where: { userId },
        create: { userId, balance: 0 },
        update: {},
    });
}
async function getBalance(userId) {
    const wallet = await getOrCreateWallet(userId);
    return wallet.balance;
}
async function creditWallet(userId, amount, type, referenceId, description) {
    const wallet = await getOrCreateWallet(userId);
    const amt = new library_1.Decimal(amount.toString());
    const newBalance = new library_1.Decimal(wallet.balance.toString()).add(amt);
    await prisma_1.default.wallet.update({
        where: { userId },
        data: { balance: newBalance },
    });
    await prisma_1.default.transaction.create({
        data: {
            userId,
            type,
            amount: amt,
            balanceBefore: wallet.balance,
            balanceAfter: newBalance,
            status: 'COMPLETED',
            referenceId,
            description,
        },
    });
    await (0, pusher_1.triggerUserEvent)(userId, 'balance-updated', { newBalance: newBalance.toFixed(2) });
}
async function debitWallet(userId, amount, type, referenceId, description) {
    const wallet = await getOrCreateWallet(userId);
    const amt = new library_1.Decimal(amount.toString());
    const balance = new library_1.Decimal(wallet.balance.toString());
    if (balance.lessThan(amt)) {
        throw new Error(`Insufficient balance. Available: ${balance.toFixed(2)}, Required: ${amt.toFixed(2)}`);
    }
    const newBalance = balance.sub(amt);
    await prisma_1.default.wallet.update({
        where: { userId },
        data: { balance: newBalance },
    });
    await prisma_1.default.transaction.create({
        data: {
            userId,
            type,
            amount: amt,
            balanceBefore: wallet.balance,
            balanceAfter: newBalance,
            status: 'COMPLETED',
            referenceId,
            description,
        },
    });
    await (0, pusher_1.triggerUserEvent)(userId, 'balance-updated', { newBalance: newBalance.toFixed(2) });
}
//# sourceMappingURL=wallet.service.js.map