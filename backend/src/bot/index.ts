import { Telegraf, Context, Markup } from 'telegraf';
import { config } from '../config';

// ─── Command handlers ─────────────────────────────────────────────────────────
import { handleStart }                          from './commands/start';
import { handleBalance }                        from './commands/balance';
import { handleDeposit,
         handleDepositManual }                  from './commands/deposit';
import { handleBuyTicket, handleJoinRoom }      from './commands/buyticket';
import { handleMyCards, handleResults }         from './commands/mycards';
import { handleWithdraw, handleSupport }        from './commands/withdraw';
import { handleInstructions }                   from './commands/instructions';
import { handlePlayBingoMenu }                  from './commands/playbingo';
import { handlePlaySpinMenu }                   from './commands/playspin';
import { handleRegister }                       from './commands/register';
import { handleInvite }                         from './commands/invite';
import { handleChangeName,
         handleChangeNameCancel,
         handleChangeNameMessage }              from './commands/change_name';
import { handleGameHistory }                    from './commands/game_history';
import { handleCheckTransaction }              from './commands/check_transaction';
import { handleTransfer,
         handleTransferConfirm,
         handleTransferCancel,
         handleTransferMessage }               from './commands/transfer';

// ─── Deposit flow ─────────────────────────────────────────────────────────────
import {
  handleDepositMessage, handleDepositCancel, handleDepositSubmit,
  handlePayCbeBirr, handlePayCbeBank, handlePayMpesa, handlePayTelebirr,
} from './commands/depositFlow';

// ─── Admin ────────────────────────────────────────────────────────────────────
import {
  handleAdminPanel, handleAdminDeposits, handleAdminWithdrawals,
  handleApproveDeposit, handleRejectDeposit,
  handleApproveWithdrawal, handleRejectWithdrawal,
} from './commands/admin';

// ─── Services ─────────────────────────────────────────────────────────────────
import { updateUserPhone } from '../services/user.service';
import { logger }          from '../lib/logger';

export function createBot(): Telegraf {
  const bot = new Telegraf(config.bot.token);

  // ═══════════════════════════════════════════════════════════════════════════
  //  SLASH COMMANDS
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Core ─────────────────────────────────────────────────────────────────
  bot.command('start',             ctx => handleStart(ctx));
  bot.command('playbingo',         ctx => handlePlayBingoMenu(ctx));
  bot.command('playspin',          ctx => handlePlaySpinMenu(ctx));
  bot.command('register',          ctx => handleRegister(ctx));

  // ─── Wallet ───────────────────────────────────────────────────────────────
  bot.command('balance',           ctx => handleBalance(ctx));
  bot.command('deposit',           ctx => handleDeposit(ctx));
  bot.command('withdraw',          ctx => handleWithdraw(ctx));
  bot.command('transfer',          ctx => handleTransfer(ctx));

  // ─── Account ──────────────────────────────────────────────────────────────
  bot.command('change_name',       ctx => handleChangeName(ctx));
  bot.command('game_history',      ctx => handleGameHistory(ctx));
  bot.command('check_transaction', ctx => handleCheckTransaction(ctx));
  bot.command('invite',            ctx => handleInvite(ctx));

  // ─── Help & Support ───────────────────────────────────────────────────────
  bot.command('instruction',       ctx => handleInstructions(ctx));
  bot.command('instructions',      ctx => handleInstructions(ctx));
  bot.command('support',           ctx => handleSupport(ctx));

  // ─── Legacy / extra ───────────────────────────────────────────────────────
  bot.command('buyticket',         ctx => handleBuyTicket(ctx));
  bot.command('join',              ctx => handleBuyTicket(ctx));
  bot.command('mycards',           ctx => handleMyCards(ctx));
  bot.command('results',           ctx => handleResults(ctx));

  // ─── Admin ────────────────────────────────────────────────────────────────
  bot.command('admin',             ctx => handleAdminPanel(ctx));
  bot.command('deposits',          ctx => handleAdminDeposits(ctx));
  bot.command('withdrawals',       ctx => handleAdminWithdrawals(ctx));

  // ═══════════════════════════════════════════════════════════════════════════
  //  INLINE BUTTON CALLBACKS
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Main menu ────────────────────────────────────────────────────────────
  bot.action('cmd_start',          ctx => handleStart(ctx));
  bot.action('cmd_play_bingo',     ctx => handlePlayBingoMenu(ctx));
  bot.action('cmd_play_spin',      ctx => handlePlaySpinMenu(ctx));
  bot.action('cmd_register',       ctx => handleRegister(ctx));

  // ─── Wallet ───────────────────────────────────────────────────────────────
  bot.action('cmd_balance',        ctx => handleBalance(ctx));
  bot.action('cmd_deposit',        ctx => handleDeposit(ctx));
  bot.action('cmd_deposit_manual', ctx => handleDepositManual(ctx));
  bot.action('cmd_deposit_cancel', ctx => handleDepositCancel(ctx));
  bot.action('cmd_deposit_submit', ctx => handleDepositSubmit(ctx));
  bot.action('cmd_withdraw',       ctx => handleWithdraw(ctx));
  bot.action('cmd_transfer',       ctx => handleTransfer(ctx));

  // ─── Payment method sub-actions ───────────────────────────────────────────
  bot.action('cmd_pay_cbe_birr',   ctx => handlePayCbeBirr(ctx));
  bot.action('cmd_pay_cbe_bank',   ctx => handlePayCbeBank(ctx));
  bot.action('cmd_pay_mpesa',      ctx => handlePayMpesa(ctx));
  bot.action('cmd_pay_telebirr',   ctx => handlePayTelebirr(ctx));

  // ─── Transfer flow ────────────────────────────────────────────────────────
  bot.action('cmd_transfer_confirm', ctx => handleTransferConfirm(ctx));
  bot.action('cmd_transfer_cancel',  ctx => handleTransferCancel(ctx));

  // ─── Account ──────────────────────────────────────────────────────────────
  bot.action('cmd_change_name',        ctx => handleChangeName(ctx));
  bot.action('cmd_change_name_cancel', ctx => handleChangeNameCancel(ctx));
  bot.action('cmd_game_history',       ctx => handleGameHistory(ctx));
  bot.action('cmd_check_transaction',  ctx => handleCheckTransaction(ctx));
  bot.action('cmd_invite',             ctx => handleInvite(ctx));

  // ─── Game / Cards ─────────────────────────────────────────────────────────
  bot.action('cmd_buy',            ctx => handleBuyTicket(ctx));
  bot.action('cmd_cards',          ctx => handleMyCards(ctx));
  bot.action('cmd_results',        ctx => handleResults(ctx));

  // ─── Help & Support ───────────────────────────────────────────────────────
  bot.action('cmd_support',        ctx => handleSupport(ctx));
  bot.action('cmd_instructions',   ctx => handleInstructions(ctx));

  // ─── Admin panel ──────────────────────────────────────────────────────────
  bot.action('admin_deposits',     ctx => handleAdminDeposits(ctx));
  bot.action('admin_withdrawals',  ctx => handleAdminWithdrawals(ctx));

  // ─── Pagination: game history ─────────────────────────────────────────────
  bot.action(/^gh_page_(\d+)$/, ctx => {
    const page = parseInt(ctx.match[1], 10);
    return handleGameHistory(ctx, page);
  });

  // ─── Pagination: transaction history ─────────────────────────────────────
  bot.action(/^tx_page_(\d+)$/, ctx => {
    const page = parseInt(ctx.match[1], 10);
    return handleCheckTransaction(ctx, page);
  });

  // ─── Room join ────────────────────────────────────────────────────────────
  bot.action(/^join_(.+)$/, ctx => {
    const roomType = ctx.match[1];
    return handleJoinRoom(ctx, roomType);
  });

  // ─── Deposit approve / reject (admin) ────────────────────────────────────
  bot.action(/^approve_dep_(.+)$/, ctx => handleApproveDeposit(ctx, ctx.match[1]));
  bot.action(/^reject_dep_(.+)$/,  ctx => handleRejectDeposit(ctx, ctx.match[1]));

  // ─── Withdrawal approve / reject (admin) ─────────────────────────────────
  bot.action(/^approve_wd_(.+)$/, ctx => handleApproveWithdrawal(ctx, ctx.match[1]));
  bot.action(/^reject_wd_(.+)$/,  ctx => handleRejectWithdrawal(ctx, ctx.match[1]));

  // ═══════════════════════════════════════════════════════════════════════════
  //  CONTACT — phone-number verification + referral bonus
  // ═══════════════════════════════════════════════════════════════════════════
  bot.on('contact', async (ctx) => {
    const contact = ctx.message.contact;
    const tgUser  = ctx.from!;

    if (contact.user_id !== tgUser.id) {
      return ctx.reply('❌ Please share your own contact number.');
    }

    try {
      // updateUserPhone now also awards the referral bonus and returns referrer info
      const { user, referrer } = await updateUserPhone(tgUser.id, contact.phone_number);
      logger.info(`[Bot] Phone verified for user ${tgUser.id}: ${contact.phone_number}`);

      await ctx.reply('✅ Phone number verified successfully!', Markup.removeKeyboard());

      // ── Notify referrer (non-blocking) ───────────────────────────────────────
      if (referrer) {
        try {
          await ctx.telegram.sendMessage(
            Number(referrer.telegramId),
            `🎉 <b>Referral Bonus Earned!</b>\n\n` +
            `<b>${user.firstName}</b> just joined Buna Bingo using your invite link.\n\n` +
            `💰 <b>+5.00 ETB</b> has been added to your wallet! ☕️`,
            { parse_mode: 'HTML' }
          );
          logger.info(`[Referral] Notified referrer ${referrer.id} of 5 ETB bonus`);
        } catch {
          // Non-fatal — referrer may have blocked the bot
          logger.warn(`[Referral] Could not notify referrer ${referrer.id}`);
        }
      }

      return handleStart(ctx); // Show main menu
    } catch (err) {
      logger.error('[Bot] Error saving phone number:', err);
      return ctx.reply('❌ Failed to save phone number. Please try again.');
    }
  });


  // ═══════════════════════════════════════════════════════════════════════════
  //  MESSAGE ROUTER — multi-step conversation dispatcher
  //  Priority: deposit → transfer → change_name
  // ═══════════════════════════════════════════════════════════════════════════
  bot.on('message', async (ctx) => {
    // 1. Deposit flow (text + photo)
    if (await handleDepositMessage(ctx)) return;

    // 2. Transfer flow (text only)
    if (await handleTransferMessage(ctx)) return;

    // 3. Change name flow (text only)
    if (await handleChangeNameMessage(ctx)) return;

    // 4. Unhandled — silently ignore (user may be typing a command)
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  ERROR HANDLER
  // ═══════════════════════════════════════════════════════════════════════════
  bot.catch((err: any, ctx: Context) => {
    logger.error(`[Bot] Unhandled error for ${ctx.updateType}:`, err);
  });

  return bot;
}
