"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBalance = handleBalance;
const user_service_1 = require("../../services/user.service");
const wallet_service_1 = require("../../services/wallet.service");
async function handleBalance(ctx) {
    const tgUser = ctx.from;
    try {
        const user = await (0, user_service_1.getUserByTelegramId)(tgUser.id);
        if (!user)
            return ctx.reply('❌ Please /start first to register.');
        if (ctx.callbackQuery)
            await ctx.answerCbQuery();
        const wallet = await (0, wallet_service_1.getOrCreateWallet)(user.id);
        await ctx.reply(`💰 *Your Wallet*\n\n` +
            `👤 ${user.firstName || user.telegramUsername || 'Player'}\n` +
            `💵 Balance: *${Number(wallet.balance).toFixed(2)} ETB*\n\n` +
            `🏆 Total Won: ${Number(wallet.totalWon).toFixed(2)} ETB\n` +
            `🎫 Total Spent: ${Number(wallet.totalSpent).toFixed(2)} ETB`, { parse_mode: 'Markdown' });
    }
    catch (err) {
        await ctx.reply('❌ Could not fetch balance. Try again.');
    }
}
//# sourceMappingURL=balance.js.map