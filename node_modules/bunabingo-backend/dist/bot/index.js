"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBot = createBot;
const telegraf_1 = require("telegraf");
const config_1 = require("../config");
const start_1 = require("./commands/start");
const balance_1 = require("./commands/balance");
const deposit_1 = require("./commands/deposit");
const buyticket_1 = require("./commands/buyticket");
const mycards_1 = require("./commands/mycards");
const withdraw_1 = require("./commands/withdraw");
const instructions_1 = require("./commands/instructions");
const playbingo_1 = require("./commands/playbingo");
const playspin_1 = require("./commands/playspin");
const depositFlow_1 = require("./commands/depositFlow");
const admin_1 = require("./commands/admin");
const user_service_1 = require("../services/user.service");
const logger_1 = require("../lib/logger");
function createBot() {
    const bot = new telegraf_1.Telegraf(config_1.config.bot.token);
    // ─── Commands ─────────────────────────────────────────────
    bot.command('start', ctx => (0, start_1.handleStart)(ctx));
    bot.command('balance', ctx => (0, balance_1.handleBalance)(ctx));
    bot.command('deposit', ctx => (0, deposit_1.handleDeposit)(ctx));
    bot.command('buyticket', ctx => (0, buyticket_1.handleBuyTicket)(ctx));
    bot.command('join', ctx => (0, buyticket_1.handleBuyTicket)(ctx));
    bot.command('mycards', ctx => (0, mycards_1.handleMyCards)(ctx));
    bot.command('results', ctx => (0, mycards_1.handleResults)(ctx));
    bot.command('withdraw', ctx => (0, withdraw_1.handleWithdraw)(ctx));
    bot.command('support', ctx => (0, withdraw_1.handleSupport)(ctx));
    bot.command('instructions', ctx => (0, instructions_1.handleInstructions)(ctx));
    // Admin commands
    bot.command('admin', ctx => (0, admin_1.handleAdminPanel)(ctx));
    bot.command('deposits', ctx => (0, admin_1.handleAdminDeposits)(ctx));
    bot.command('withdrawals', ctx => (0, admin_1.handleAdminWithdrawals)(ctx));
    // ─── Inline Button Callbacks ──────────────────────────────
    bot.action('cmd_balance', ctx => (0, balance_1.handleBalance)(ctx));
    bot.action('cmd_buy', ctx => (0, buyticket_1.handleBuyTicket)(ctx));
    bot.action('cmd_deposit', ctx => (0, deposit_1.handleDeposit)(ctx));
    bot.action('cmd_deposit_stars', ctx => (0, deposit_1.handleDepositStars)(ctx));
    bot.action('cmd_deposit_manual', ctx => (0, deposit_1.handleDepositManual)(ctx));
    bot.action('cmd_deposit_cancel', ctx => (0, depositFlow_1.handleDepositCancel)(ctx));
    bot.action('cmd_deposit_submit', ctx => (0, depositFlow_1.handleDepositSubmit)(ctx));
    // Payment method sub-actions
    bot.action('cmd_pay_cbe_birr', ctx => (0, depositFlow_1.handlePayCbeBirr)(ctx));
    bot.action('cmd_pay_cbe_bank', ctx => (0, depositFlow_1.handlePayCbeBank)(ctx));
    bot.action('cmd_pay_mpesa', ctx => (0, depositFlow_1.handlePayMpesa)(ctx));
    bot.action('cmd_pay_telebirr', ctx => (0, depositFlow_1.handlePayTelebirr)(ctx));
    bot.action('cmd_withdraw', ctx => (0, withdraw_1.handleWithdraw)(ctx));
    bot.action('cmd_cards', ctx => (0, mycards_1.handleMyCards)(ctx));
    bot.action('cmd_results', ctx => (0, mycards_1.handleResults)(ctx));
    bot.action('cmd_support', ctx => (0, withdraw_1.handleSupport)(ctx));
    bot.action('cmd_instructions', ctx => (0, instructions_1.handleInstructions)(ctx));
    bot.action('cmd_play_bingo', ctx => (0, playbingo_1.handlePlayBingoMenu)(ctx));
    bot.action('cmd_play_spin', ctx => (0, playspin_1.handlePlaySpinMenu)(ctx));
    bot.action('admin_deposits', ctx => (0, admin_1.handleAdminDeposits)(ctx));
    bot.action('admin_withdrawals', ctx => (0, admin_1.handleAdminWithdrawals)(ctx));
    // Room join actions
    bot.action(/^join_(.+)$/, ctx => {
        const roomType = ctx.match[1];
        return (0, buyticket_1.handleJoinRoom)(ctx, roomType);
    });
    // Deposit approve/reject
    bot.action(/^approve_dep_(.+)$/, ctx => (0, admin_1.handleApproveDeposit)(ctx, ctx.match[1]));
    bot.action(/^reject_dep_(.+)$/, ctx => (0, admin_1.handleRejectDeposit)(ctx, ctx.match[1]));
    // Withdrawal approve/reject
    bot.action(/^approve_wd_(.+)$/, ctx => (0, admin_1.handleApproveWithdrawal)(ctx, ctx.match[1]));
    bot.action(/^reject_wd_(.+)$/, ctx => (0, admin_1.handleRejectWithdrawal)(ctx, ctx.match[1]));
    // ─── Contact message handler (registration) ─────────────────────────────
    bot.on('contact', async (ctx) => {
        const contact = ctx.message.contact;
        const tgUser = ctx.from;
        if (contact.user_id !== tgUser.id) {
            return ctx.reply('❌ Please share your own contact number.');
        }
        try {
            await (0, user_service_1.updateUserPhone)(tgUser.id, contact.phone_number);
            logger_1.logger.info(`[Bot] Saved phone number for user ${tgUser.id}: ${contact.phone_number}`);
            await ctx.reply('✅ Phone number verified successfully!', telegraf_1.Markup.removeKeyboard());
            return (0, start_1.handleStart)(ctx); // Show main menu
        }
        catch (err) {
            logger_1.logger.error('[Bot] Error saving phone number:', err);
            return ctx.reply('❌ Failed to save phone number. Please try again.');
        }
    });
    // ─── Text/Photo message handler (deposit conversation flow) ─────────────
    bot.on('message', async (ctx) => {
        const handled = await (0, depositFlow_1.handleDepositMessage)(ctx);
        // If not handled by deposit flow, ignore (other handlers deal with it)
    });
    // ─── Error handler ────────────────────────────────────────────────────────
    bot.catch((err, ctx) => {
        logger_1.logger.error(`Bot error for ${ctx.updateType}:`, err);
    });
    return bot;
}
//# sourceMappingURL=index.js.map