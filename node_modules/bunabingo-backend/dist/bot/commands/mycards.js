"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMyCards = handleMyCards;
exports.handleResults = handleResults;
const telegraf_1 = require("telegraf");
const user_service_1 = require("../../services/user.service");
const config_1 = require("../../config");
const prisma_1 = __importDefault(require("../../lib/prisma"));
async function handleMyCards(ctx) {
    const tgUser = ctx.from;
    try {
        const user = await (0, user_service_1.getUserByTelegramId)(tgUser.id);
        if (!user)
            return ctx.reply('❌ Please /start first.');
        const tickets = await prisma_1.default.ticket.findMany({
            where: { userId: user.id },
            include: {
                game: { include: { room: true } },
                winners: true,
            },
            orderBy: { purchasedAt: 'desc' },
            take: 5,
        });
        if (!tickets.length) {
            return ctx.reply(`🃏 *My Cards*\n\nYou have no tickets yet.\nBuy one with /buyticket!`, { parse_mode: 'Markdown' });
        }
        let msg = `🃏 *My Recent Cards*\n\n`;
        for (const ticket of tickets) {
            const status = ticket.game.status === 'RUNNING' ? '🟢 LIVE' :
                ticket.game.status === 'FINISHED' ? (ticket.isWinner ? '🏆 WON' : '❌ Lost') :
                    ticket.game.status === 'WAITING' ? '⏳ Waiting' :
                        ticket.game.status === 'COUNTDOWN' ? '⏱ Starting' :
                            '🚫 Cancelled';
            msg += `🎮 *${ticket.game.room.type}* — ${status}\n`;
            msg += `📅 ${ticket.purchasedAt.toLocaleDateString()}\n\n`;
        }
        await ctx.reply(msg, {
            parse_mode: 'Markdown',
            ...telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.webApp('🃏 View All Cards', `${config_1.config.bot.miniAppUrl}/tickets`)],
            ]),
        });
    }
    catch {
        await ctx.reply('❌ Error loading cards.');
    }
}
async function handleResults(ctx) {
    const tgUser = ctx.from;
    try {
        const user = await (0, user_service_1.getUserByTelegramId)(tgUser.id);
        if (!user)
            return ctx.reply('❌ Please /start first.');
        const recentWins = await prisma_1.default.winner.findMany({
            where: { userId: user.id },
            include: { game: { include: { room: true } } },
            orderBy: { paidAt: 'desc' },
            take: 5,
        });
        const recentGames = await prisma_1.default.ticket.findMany({
            where: { userId: user.id },
            include: { game: { include: { room: true, winners: true } } },
            orderBy: { purchasedAt: 'desc' },
            take: 5,
        });
        let msg = `📊 *My Results*\n\n`;
        if (recentWins.length) {
            msg += `🏆 *Recent Wins:*\n`;
            for (const w of recentWins) {
                msg += `• ${w.winMode} — +${Number(w.prizeAmount).toFixed(2)} ETB (${w.game.room.type})\n`;
            }
            msg += '\n';
        }
        else {
            msg += `🏆 No wins yet — keep playing!\n\n`;
        }
        msg += `🎮 *Recent Games:*\n`;
        for (const t of recentGames) {
            const result = t.isWinner ? '🏆 Won' : t.game.status === 'FINISHED' ? '❌ Lost' : '⏳ Active';
            msg += `• ${t.game.room.type} — ${result}\n`;
        }
        await ctx.reply(msg, {
            parse_mode: 'Markdown',
            ...telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.webApp('📊 Full History', `${config_1.config.bot.miniAppUrl}/history`)],
            ]),
        });
    }
    catch {
        await ctx.reply('❌ Error fetching results.');
    }
}
//# sourceMappingURL=mycards.js.map