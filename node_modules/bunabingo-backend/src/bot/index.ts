import { Telegraf, Context, Markup } from 'telegraf';
import { config } from '../config';
import { handleStart } from './commands/start';
import { handleBalance } from './commands/balance';
import { handleDeposit, handleDepositStars, handleDepositManual } from './commands/deposit';
import { handleBuyTicket, handleJoinRoom } from './commands/buyticket';
import { handleMyCards, handleResults } from './commands/mycards';
import { handleWithdraw, handleSupport } from './commands/withdraw';
import { handleInstructions } from './commands/instructions';
import { handlePlayBingoMenu } from './commands/playbingo';
import { handlePlaySpinMenu } from './commands/playspin';
import {
  handleDepositMessage, handleDepositCancel, handleDepositSubmit,
  handlePayCbeBirr, handlePayCbeBank, handlePayMpesa, handlePayTelebirr,
} from './commands/depositFlow';
import {
  handleAdminPanel, handleAdminDeposits, handleAdminWithdrawals,
  handleApproveDeposit, handleRejectDeposit,
  handleApproveWithdrawal, handleRejectWithdrawal,
} from './commands/admin';
import { updateUserPhone } from '../services/user.service';
import { logger } from '../lib/logger';

export function createBot(): Telegraf {
  const bot = new Telegraf(config.bot.token);

  // ─── Commands ─────────────────────────────────────────────
  bot.command('start',      ctx => handleStart(ctx));
  bot.command('balance',    ctx => handleBalance(ctx));
  bot.command('deposit',    ctx => handleDeposit(ctx));
  bot.command('buyticket',  ctx => handleBuyTicket(ctx));
  bot.command('join',       ctx => handleBuyTicket(ctx));
  bot.command('mycards',    ctx => handleMyCards(ctx));
  bot.command('results',    ctx => handleResults(ctx));
  bot.command('withdraw',   ctx => handleWithdraw(ctx));
  bot.command('support',    ctx => handleSupport(ctx));
  bot.command('instructions', ctx => handleInstructions(ctx));

  // Admin commands
  bot.command('admin',       ctx => handleAdminPanel(ctx));
  bot.command('deposits',    ctx => handleAdminDeposits(ctx));
  bot.command('withdrawals', ctx => handleAdminWithdrawals(ctx));

  // ─── Inline Button Callbacks ──────────────────────────────
  bot.action('cmd_balance',    ctx => handleBalance(ctx));
  bot.action('cmd_buy',        ctx => handleBuyTicket(ctx));
  bot.action('cmd_deposit',        ctx => handleDeposit(ctx));
  bot.action('cmd_deposit_stars',  ctx => handleDepositStars(ctx));
  bot.action('cmd_deposit_manual', ctx => handleDepositManual(ctx));
  bot.action('cmd_deposit_cancel', ctx => handleDepositCancel(ctx));
  bot.action('cmd_deposit_submit', ctx => handleDepositSubmit(ctx));
  // Payment method sub-actions
  bot.action('cmd_pay_cbe_birr',  ctx => handlePayCbeBirr(ctx));
  bot.action('cmd_pay_cbe_bank',  ctx => handlePayCbeBank(ctx));
  bot.action('cmd_pay_mpesa',     ctx => handlePayMpesa(ctx));
  bot.action('cmd_pay_telebirr',  ctx => handlePayTelebirr(ctx));
  bot.action('cmd_withdraw',   ctx => handleWithdraw(ctx));
  bot.action('cmd_cards',      ctx => handleMyCards(ctx));
  bot.action('cmd_results',    ctx => handleResults(ctx));
  bot.action('cmd_support',    ctx => handleSupport(ctx));
  bot.action('cmd_instructions', ctx => handleInstructions(ctx));
  bot.action('cmd_play_bingo',   ctx => handlePlayBingoMenu(ctx));
  bot.action('cmd_play_spin',    ctx => handlePlaySpinMenu(ctx));
  bot.action('admin_deposits',    ctx => handleAdminDeposits(ctx));
  bot.action('admin_withdrawals', ctx => handleAdminWithdrawals(ctx));

  // Room join actions
  bot.action(/^join_(.+)$/, ctx => {
    const roomType = ctx.match[1];
    return handleJoinRoom(ctx, roomType);
  });

  // Deposit approve/reject
  bot.action(/^approve_dep_(.+)$/, ctx => handleApproveDeposit(ctx, ctx.match[1]));
  bot.action(/^reject_dep_(.+)$/,  ctx => handleRejectDeposit(ctx, ctx.match[1]));

  // Withdrawal approve/reject
  bot.action(/^approve_wd_(.+)$/, ctx => handleApproveWithdrawal(ctx, ctx.match[1]));
  bot.action(/^reject_wd_(.+)$/,  ctx => handleRejectWithdrawal(ctx, ctx.match[1]));

  // ─── Contact message handler (registration) ─────────────────────────────
  bot.on('contact', async (ctx) => {
    const contact = ctx.message.contact;
    const tgUser = ctx.from!;
    
    if (contact.user_id !== tgUser.id) {
      return ctx.reply('❌ Please share your own contact number.');
    }

    try {
      await updateUserPhone(tgUser.id, contact.phone_number);
      logger.info(`[Bot] Saved phone number for user ${tgUser.id}: ${contact.phone_number}`);
      
      await ctx.reply('✅ Phone number verified successfully!', Markup.removeKeyboard());
      return handleStart(ctx); // Show main menu
    } catch (err) {
      logger.error('[Bot] Error saving phone number:', err);
      return ctx.reply('❌ Failed to save phone number. Please try again.');
    }
  });

  // ─── Text/Photo message handler (deposit conversation flow) ─────────────
  bot.on('message', async (ctx) => {
    const handled = await handleDepositMessage(ctx);
    // If not handled by deposit flow, ignore (other handlers deal with it)
  });

  // ─── Error handler ────────────────────────────────────────────────────────
  bot.catch((err: any, ctx: Context) => {
    logger.error(`Bot error for ${ctx.updateType}:`, err);
  });

  return bot;
}
