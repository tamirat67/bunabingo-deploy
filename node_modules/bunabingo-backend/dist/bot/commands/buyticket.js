"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBuyTicket = handleBuyTicket;
exports.handleJoinRoom = handleJoinRoom;
const telegraf_1 = require("telegraf");
const user_service_1 = require("../../services/user.service");
const room_manager_1 = require("../../game/room.manager");
const engine_1 = require("../../game/engine");
const config_1 = require("../../config");
const ROOM_LABELS = {
    CASUAL: '🟢 Casual Room',
    STANDARD: '🔵 Standard Room',
    JACKPOT: '💎 Jackpot Room',
};
async function handleBuyTicket(ctx) {
    const tgUser = ctx.from;
    try {
        const user = await (0, user_service_1.getUserByTelegramId)(tgUser.id);
        if (!user)
            return ctx.reply('❌ Please /start first to register.');
        if (!user.phoneNumber) {
            return ctx.reply(`📱 <b>Phone Verification Required</b>\n\nPlease share your phone number using the button below before you can join a game.`, {
                parse_mode: 'HTML',
                ...telegraf_1.Markup.keyboard([
                    [telegraf_1.Markup.button.contactRequest('📱 Share Phone Number')]
                ]).oneTime().resize()
            });
        }
        const rooms = await (0, room_manager_1.getRooms)();
        const roomButtons = rooms.map(room => {
            const activeGame = room.games[0];
            const players = activeGame?.tickets?.length ?? 0;
            const label = ROOM_LABELS[room.type] || room.type;
            const price = Number(room.ticketPrice).toFixed(0);
            return [telegraf_1.Markup.button.callback(`${label} — ${price} ETB (${players} players)`, `join_${room.type}`)];
        });
        await ctx.reply(`🎫 *Buy Bingo Ticket*\n\n` +
            `Choose a room to join:\n\n` +
            `🟢 *Casual* — 2+ players · 10 ETB · 30s countdown\n` +
            `🔵 *Standard* — 5+ players · 25 ETB · 15s countdown\n` +
            `💎 *Jackpot* — 20+ players · 100 ETB · 5s countdown\n\n` +
            `Game starts automatically when minimum players join!`, {
            parse_mode: 'Markdown',
            ...telegraf_1.Markup.inlineKeyboard([
                ...roomButtons,
                [telegraf_1.Markup.button.webApp('🎮 Open in Mini App', `${config_1.config.bot.miniAppUrl}/tickets`)],
            ]),
        });
    }
    catch (err) {
        await ctx.reply('❌ Error loading rooms. Please try again.');
    }
}
async function handleJoinRoom(ctx, roomType) {
    const tgUser = ctx.from;
    try {
        const user = await (0, user_service_1.getUserByTelegramId)(tgUser.id);
        if (!user)
            return ctx.answerCbQuery('❌ Please /start first.');
        if (user.status === 'BANNED')
            return ctx.answerCbQuery('❌ Account banned.');
        if (user.status === 'SUSPENDED')
            return ctx.answerCbQuery('❌ Account suspended.');
        if (!user.phoneNumber) {
            await ctx.answerCbQuery('❌ Phone verification required!');
            return ctx.reply(`📱 <b>Phone Verification Required</b>\n\nPlease share your phone number to join games.`, {
                parse_mode: 'HTML',
                ...telegraf_1.Markup.keyboard([
                    [telegraf_1.Markup.button.contactRequest('📱 Share Phone Number')]
                ]).oneTime().resize()
            });
        }
        const { getRoomWithActiveGame } = await Promise.resolve().then(() => __importStar(require('../../game/room.manager')));
        const room = await getRoomWithActiveGame(roomType);
        if (!room) {
            await ctx.answerCbQuery('❌ Room not found.');
            return;
        }
        const activeGame = room.games[0];
        if (!activeGame) {
            await ctx.answerCbQuery('❌ No active game. Please try again.');
            return;
        }
        const { tickets, cards } = await (0, engine_1.joinGame)(user.id, activeGame.id);
        const ticket = tickets[0];
        const card = cards[0];
        const cardDisplay = card.map((row, r) => row.map((cell, c) => {
            if (cell === 'FREE')
                return '⭐';
            return String(cell).padStart(2, ' ');
        }).join(' | ')).join('\n');
        await ctx.answerCbQuery('🎫 Joined! Good luck!');
        await ctx.reply(`✅ *Joined ${ROOM_LABELS[roomType]}!*\n\n` +
            `🃏 Your Bingo Card:\n` +
            `\`B  | I  | N  | G  | O\n` +
            `${cardDisplay}\`\n\n` +
            `⏳ Waiting for more players...\n` +
            `📱 Open Mini App to play live!`, {
            parse_mode: 'Markdown',
            ...telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.webApp('🎮 Play Live', `${config_1.config.bot.miniAppUrl}/game?id=${activeGame.id}`)],
            ]),
        });
    }
    catch (err) {
        await ctx.answerCbQuery(`❌ ${err.message || 'Error joining game'}`);
    }
}
//# sourceMappingURL=buyticket.js.map