"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStart = handleStart;
const telegraf_1 = require("telegraf");
const user_service_1 = require("../../services/user.service");
const wallet_service_1 = require("../../services/wallet.service");
const config_1 = require("../../config");
const logger_1 = require("../../lib/logger");
async function handleStart(ctx) {
    const tgUser = ctx.from;
    const referrerId = ctx.startPayload; // Deep link payload (e.g. from ?start=USER_ID)
    try {
        const user = await (0, user_service_1.findOrCreateUser)({
            id: tgUser.id,
            username: tgUser.username,
            first_name: tgUser.first_name,
            last_name: tgUser.last_name,
        }, referrerId);
        await (0, wallet_service_1.getOrCreateWallet)(user.id);
        if (!user.phoneNumber) {
            logger_1.logger.info(`[Bot] User ${tgUser.id} has no phone. Requesting contact...`);
            return ctx.reply(`👋 Welcome, <b>${tgUser.first_name}</b>!\n\nTo ensure a secure experience and prevent multiple accounts, please share your phone number to continue.`, {
                parse_mode: 'HTML',
                ...telegraf_1.Markup.keyboard([
                    [telegraf_1.Markup.button.contactRequest('📱 Share Phone Number')]
                ]).oneTime().resize()
            });
        }
        const inviteLink = `https://t.me/${ctx.botInfo.username}?start=${user.id}`;
        const shareText = encodeURIComponent(`Join me on Buna Bingo! 🎰☕️ Get 2 ETB bonus when you join!\n\nPlay here: ${inviteLink}`);
        logger_1.logger.info(`[Bot] Sending start message to ${tgUser.id} (${tgUser.first_name})`);
        await ctx.reply(`☕️ <b>Buna Bingo: Rich Flavor, Golden Wins.</b>\n` +
            `✨ <i>"The Perfect Blend of Luck and Luxury."</i>\n\n` +
            `👑 Sip, Play, Win: <b>The Royal Buna Way.</b>\n` +
            `☀️ Wake up to a <b>Jackpot</b> today!\n\n` +
            `Choose an option below to begin your journey:`, {
            parse_mode: 'HTML',
            ...telegraf_1.Markup.inlineKeyboard([
                [
                    telegraf_1.Markup.button.callback('Play Bingo 🎮', 'cmd_play_bingo'),
                    telegraf_1.Markup.button.callback('Play Spin 🎮', 'cmd_play_spin'),
                ],
                [
                    telegraf_1.Markup.button.webApp('Register 📝', config_1.config.bot.miniAppUrl),
                    telegraf_1.Markup.button.callback('Deposit 💵', 'cmd_deposit'),
                ],
                [
                    telegraf_1.Markup.button.callback('Check Balance 💰', 'cmd_balance'),
                    telegraf_1.Markup.button.url('Contact support 📞', 'https://t.me/bunabingosupport'),
                ],
                [
                    telegraf_1.Markup.button.callback('Instruction 📖', 'cmd_instructions'),
                    telegraf_1.Markup.button.url('Invite ✉️', `https://t.me/share/url?url=${inviteLink}&text=${shareText}`),
                ],
            ]),
        });
        logger_1.logger.info(`[Bot] Start message sent successfully to ${user.id}`);
    }
    catch (err) {
        logger_1.logger.error('[Bot] FATAL ERROR in handleStart:', err);
        await ctx.reply('❌ Something went wrong. Please try again.');
    }
}
//# sourceMappingURL=start.js.map