"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWithdraw = handleWithdraw;
exports.handleSupport = handleSupport;
const telegraf_1 = require("telegraf");
const user_service_1 = require("../../services/user.service");
const config_1 = require("../../config");
async function handleWithdraw(ctx) {
    const tgUser = ctx.from;
    try {
        const user = await (0, user_service_1.getUserByTelegramId)(tgUser.id);
        if (!user)
            return ctx.reply('❌ Please /start first.');
        const balance = Number(user.wallet?.balance ?? 0);
        await ctx.reply(`💸 *Withdraw Funds*\n\n` +
            `💰 Available Balance: *${balance.toFixed(2)} ETB*\n\n` +
            `📋 *Withdrawal Rules:*\n` +
            `• Minimum: ${config_1.config.withdrawal.minAmount} ETB\n` +
            `• Maximum: ${config_1.config.withdrawal.maxAmount} ETB\n` +
            `• Admin approval required (usually within 2 hours)\n` +
            `• Only one pending request at a time\n\n` +
            `Use the Mini App to submit your request 👇`, {
            parse_mode: 'Markdown',
            ...telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.webApp('💸 Request Withdrawal', `${config_1.config.bot.miniAppUrl}/withdraw`)],
            ]),
        });
    }
    catch {
        await ctx.reply('❌ Error. Please try again.');
    }
}
async function handleSupport(ctx) {
    await ctx.reply(`📞 <b>Customer Support</b>\n\n` +
        `Need help? Our agents are available 24/7 to assist you with deposits, withdrawals, or game rules.\n\n` +
        `💬 Contact us here: <b>@bunabingosupport</b>`, {
        parse_mode: 'Markdown',
        ...telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.webApp('🆘 Open Support', `${config_1.config.bot.miniAppUrl}/support`)],
        ]),
    });
}
//# sourceMappingURL=withdraw.js.map