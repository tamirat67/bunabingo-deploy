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
exports.handleDeposit = handleDeposit;
exports.handleDepositStars = handleDepositStars;
exports.handleDepositManual = handleDepositManual;
const telegraf_1 = require("telegraf");
const user_service_1 = require("../../services/user.service");
const config_1 = require("../../config");
// ─── Step 1: Show deposit method selector ─────────────────────────────────────
async function handleDeposit(ctx) {
    const tgUser = ctx.from;
    try {
        const user = await (0, user_service_1.getUserByTelegramId)(tgUser.id);
        if (!user)
            return ctx.reply('❌ Please /start first to register.');
        if (ctx.callbackQuery)
            await ctx.answerCbQuery();
        await ctx.reply(`Choose Your Preferred Deposit Method`, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('Telegram Star', 'cmd_deposit_stars')],
            [telegraf_1.Markup.button.callback('Manual', 'cmd_deposit_manual')],
        ]));
    }
    catch (err) {
        await ctx.reply('❌ Error. Please try again.');
    }
}
// ─── Step 2a: Telegram Stars deposit ──────────────────────────────────────────
async function handleDepositStars(ctx) {
    if (ctx.callbackQuery)
        await ctx.answerCbQuery();
    await ctx.reply(`⭐ *Telegram Stars Deposit*\n\n` +
        `Pay instantly using your Telegram Stars balance.\n\n` +
        `📋 *How it works:*\n` +
        `1️⃣ Choose an amount below\n` +
        `2️⃣ Complete the payment inside Telegram\n` +
        `3️⃣ Your wallet is credited automatically ⚡\n\n` +
        `No waiting · No screenshots · Instant credit`, {
        parse_mode: 'Markdown',
        ...telegraf_1.Markup.inlineKeyboard([
            [
                telegraf_1.Markup.button.webApp('⭐ 50 Stars', `${config_1.config.bot.miniAppUrl}/deposit/stars?amount=50`),
                telegraf_1.Markup.button.webApp('⭐ 100 Stars', `${config_1.config.bot.miniAppUrl}/deposit/stars?amount=100`),
            ],
            [
                telegraf_1.Markup.button.webApp('⭐ 250 Stars', `${config_1.config.bot.miniAppUrl}/deposit/stars?amount=250`),
                telegraf_1.Markup.button.webApp('⭐ 500 Stars', `${config_1.config.bot.miniAppUrl}/deposit/stars?amount=500`),
            ],
            [telegraf_1.Markup.button.callback('⬅️ Back', 'cmd_deposit')],
        ]),
    });
}
// ─── Step 2b: Manual deposit — kicks off in-bot conversation ──────────────────
async function handleDepositManual(ctx) {
    const { handleDepositManualStart } = await Promise.resolve().then(() => __importStar(require('./depositFlow')));
    await handleDepositManualStart(ctx);
}
//# sourceMappingURL=deposit.js.map