"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAdminPanel = handleAdminPanel;
exports.handleAdminDeposits = handleAdminDeposits;
exports.handleAdminWithdrawals = handleAdminWithdrawals;
exports.handleApproveDeposit = handleApproveDeposit;
exports.handleRejectDeposit = handleRejectDeposit;
exports.handleApproveWithdrawal = handleApproveWithdrawal;
exports.handleRejectWithdrawal = handleRejectWithdrawal;
const telegraf_1 = require("telegraf");
const user_service_1 = require("../../services/user.service");
const deposit_service_1 = require("../../services/deposit.service");
const withdrawal_service_1 = require("../../services/withdrawal.service");
const user_service_2 = require("../../services/user.service");
const prisma_1 = __importDefault(require("../../lib/prisma"));
const config_1 = require("../../config");
async function requireAdmin(ctx) {
    const tgUser = ctx.from;
    if (!(0, user_service_1.isAdmin)(tgUser.id)) {
        await ctx.reply('❌ Admin only command.');
        return null;
    }
    const user = await (0, user_service_2.getUserByTelegramId)(tgUser.id);
    return user?.id ?? null;
}
async function handleAdminPanel(ctx) {
    const tgUser = ctx.from;
    if (!(0, user_service_1.isAdmin)(tgUser.id))
        return ctx.reply('❌ Unauthorized.');
    const [pendingDeposits, pendingWithdrawals, totalUsers, activeGames] = await Promise.all([
        prisma_1.default.deposit.count({ where: { status: 'PENDING' } }),
        prisma_1.default.withdrawal.count({ where: { status: 'PENDING' } }),
        prisma_1.default.user.count(),
        prisma_1.default.game.count({ where: { status: { in: ['RUNNING', 'COUNTDOWN', 'WAITING'] } } }),
    ]);
    await ctx.reply(`🛡️ *Admin Panel*\n\n` +
        `📥 Pending Deposits: *${pendingDeposits}*\n` +
        `📤 Pending Withdrawals: *${pendingWithdrawals}*\n` +
        `👥 Total Users: *${totalUsers}*\n` +
        `🎮 Active Games: *${activeGames}*\n`, {
        parse_mode: 'Markdown',
        ...telegraf_1.Markup.inlineKeyboard([
            [
                telegraf_1.Markup.button.callback(`📥 Deposits (${pendingDeposits})`, 'admin_deposits'),
                telegraf_1.Markup.button.callback(`📤 Withdrawals (${pendingWithdrawals})`, 'admin_withdrawals'),
            ],
            [telegraf_1.Markup.button.webApp('📊 Full Dashboard', `${config_1.config.bot.miniAppUrl}/admin`)],
        ]),
    });
}
async function handleAdminDeposits(ctx) {
    const adminId = await requireAdmin(ctx);
    if (!adminId)
        return;
    const deposits = await (0, deposit_service_1.getPendingDeposits)();
    if (!deposits.length) {
        return ctx.reply('✅ No pending deposits.');
    }
    for (const dep of deposits.slice(0, 5)) {
        const userName = dep.user?.username ? `@${dep.user.username}` : dep.user?.firstName ?? 'User';
        await ctx.reply(`📥 *Deposit Request*\n\n` +
            `👤 User: ${userName}\n` +
            `💵 Amount: *${Number(dep.amount).toFixed(2)} ETB*\n` +
            `🔖 Reference: ${dep.reference || 'N/A'}\n` +
            `📅 Submitted: ${dep.createdAt.toLocaleString()}`, {
            parse_mode: 'Markdown',
            ...telegraf_1.Markup.inlineKeyboard([
                [
                    telegraf_1.Markup.button.callback('✅ Approve', `approve_dep_${dep.id}`),
                    telegraf_1.Markup.button.callback('❌ Reject', `reject_dep_${dep.id}`),
                ],
            ]),
        });
    }
}
async function handleAdminWithdrawals(ctx) {
    const adminId = await requireAdmin(ctx);
    if (!adminId)
        return;
    const withdrawals = await (0, withdrawal_service_1.getPendingWithdrawals)();
    if (!withdrawals.length) {
        return ctx.reply('✅ No pending withdrawals.');
    }
    for (const wd of withdrawals.slice(0, 5)) {
        const userName = wd.user?.telegramUsername ? `@${wd.user.telegramUsername}` : wd.user?.firstName ?? 'User';
        await ctx.reply(`📤 *Withdrawal Request*\n\n` +
            `👤 User: ${userName}\n` +
            `💵 Amount: *${Number(wd.amount).toFixed(2)} ETB*\n` +
            `🏦 Bank: ${wd.bankName}\n` +
            `👤 Account: ${wd.accountName}\n` +
            `🔢 Account #: ${wd.accountNumber}\n` +
            `📅 Submitted: ${wd.createdAt.toLocaleString()}`, {
            parse_mode: 'Markdown',
            ...telegraf_1.Markup.inlineKeyboard([
                [
                    telegraf_1.Markup.button.callback('✅ Approve', `approve_wd_${wd.id}`),
                    telegraf_1.Markup.button.callback('❌ Reject', `reject_wd_${wd.id}`),
                ],
            ]),
        });
    }
}
async function handleApproveDeposit(ctx, depositId) {
    const adminId = await requireAdmin(ctx);
    if (!adminId)
        return;
    try {
        await (0, deposit_service_1.approveDeposit)(depositId, adminId);
        await ctx.answerCbQuery('✅ Deposit approved!');
        await ctx.editMessageText(`✅ *Deposit Approved*\nID: \`${depositId}\``, { parse_mode: 'Markdown' });
    }
    catch (e) {
        await ctx.answerCbQuery(`❌ ${e.message}`);
    }
}
async function handleRejectDeposit(ctx, depositId) {
    const adminId = await requireAdmin(ctx);
    if (!adminId)
        return;
    try {
        await (0, deposit_service_1.rejectDeposit)(depositId, adminId, 'Rejected by admin');
        await ctx.answerCbQuery('❌ Deposit rejected');
        await ctx.editMessageText(`❌ *Deposit Rejected*\nID: \`${depositId}\``, { parse_mode: 'Markdown' });
    }
    catch (e) {
        await ctx.answerCbQuery(`❌ ${e.message}`);
    }
}
async function handleApproveWithdrawal(ctx, withdrawalId) {
    const adminId = await requireAdmin(ctx);
    if (!adminId)
        return;
    try {
        await (0, withdrawal_service_1.approveWithdrawal)(withdrawalId, adminId);
        await ctx.answerCbQuery('✅ Withdrawal approved!');
        await ctx.editMessageText(`✅ *Withdrawal Approved*\nID: \`${withdrawalId}\``, { parse_mode: 'Markdown' });
    }
    catch (e) {
        await ctx.answerCbQuery(`❌ ${e.message}`);
    }
}
async function handleRejectWithdrawal(ctx, withdrawalId) {
    const adminId = await requireAdmin(ctx);
    if (!adminId)
        return;
    try {
        await (0, withdrawal_service_1.rejectWithdrawal)(withdrawalId, adminId, 'Rejected by admin');
        await ctx.answerCbQuery('❌ Withdrawal rejected');
        await ctx.editMessageText(`❌ *Withdrawal Rejected*\nID: \`${withdrawalId}\``, { parse_mode: 'Markdown' });
    }
    catch (e) {
        await ctx.answerCbQuery(`❌ ${e.message}`);
    }
}
//# sourceMappingURL=admin.js.map