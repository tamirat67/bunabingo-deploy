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
import { handlePlayBingoMenu, handleVipRoom }                  from './commands/playbingo';
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
import { handleCmd }                            from './commands/cmd';
import { handlePlayAviator }                    from './commands/aviator';

// ─── Deposit flow ─────────────────────────────────────────────────────────────
import {
  handleDepositMessage, handleDepositCancel, handleDepositSubmit,
  handlePayAccount,
} from './commands/depositFlow';

// ─── Withdrawal flow ──────────────────────────────────────────────────────────
import {
  handleWithdrawMessage, handleWithdrawCancel
} from './commands/withdrawFlow';

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
  bot.command('register',          ctx => handleRegister(ctx));
  bot.command('vip',               ctx => handleVipRoom(ctx));

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

  // ─── Commands list ────────────────────────────────────────────────────────
  bot.command('cmd',               ctx => handleCmd(ctx));
  bot.command('commands',          ctx => handleCmd(ctx));
  bot.command('help',              ctx => handleCmd(ctx));
  bot.command('menu',              ctx => handleCmd(ctx));

  // ═══════════════════════════════════════════════════════════════════════════
  //  INLINE BUTTON CALLBACKS
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Main menu ────────────────────────────────────────────────────────────
  bot.action('cmd_start',          ctx => handleStart(ctx));
  bot.action('cmd_play_bingo',     ctx => handlePlayBingoMenu(ctx));
  bot.action('cmd_play_aviator',   ctx => handlePlayAviator(ctx));
  bot.action('cmd_register',       ctx => handleRegister(ctx));
  bot.action('cmd_vip',            ctx => handleVipRoom(ctx));

  // ─── Wallet ───────────────────────────────────────────────────────────────
  bot.action('cmd_balance',        ctx => handleBalance(ctx));
  bot.action('cmd_deposit',        ctx => handleDeposit(ctx));
  bot.action('cmd_deposit_manual', ctx => handleDepositManual(ctx));
  bot.action('cmd_deposit_cancel', ctx => handleDepositCancel(ctx));
  bot.action('cmd_deposit_submit', ctx => handleDepositSubmit(ctx));
  bot.action('cmd_withdraw',       ctx => handleWithdraw(ctx));
  bot.action('cmd_withdraw_cancel', ctx => handleWithdrawCancel(ctx));
  bot.action('cmd_transfer',       ctx => handleTransfer(ctx));

  // ─── Payment method sub-actions ───────────────────────────────────────────
  bot.action(/^cmd_pay_(.+)$/, ctx => handlePayAccount(ctx, ctx.match));

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
  bot.action('cmd_cmd',            ctx => handleCmd(ctx));

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
      return ctx.reply('❌ እባክዎ የእርስዎን የራስ ስልክ ቁጥር ያጋሩ።');
    }

    try {
      // updateUserPhone saves phone, fires referral bonus to referrer,
      // and grants the one-time 100 ETB welcome bonus to the new player
      const { user, referrer, welcomeBonusGranted } = await updateUserPhone(tgUser.id, contact.phone_number);
      logger.info(`[Bot] Phone verified for user ${tgUser.id}: ${contact.phone_number}`);

      await ctx.reply('✅ ስልክ ቁጥርዎ በተሳካ ሁኔታ ተረጋግጧል!', Markup.keyboard([
        ['🎮 ይጫወቱ'],
        ['💰 ሂሳብ', '📥 ገቢ ለማድረግ'],
        ['📤 ወጪ ለማድረግ', '🔗 ጋብዝ & አግኝ'],
        ['💎 VIP ክፍል'],
        ['🆘 እርዳታ', '📜 ደንቦች']
      ]).resize());

      // ── Welcome bonus notification (new player) ──────────────────────────────
      if (welcomeBonusGranted) {
        try {
          await ctx.reply(
            `🎉 <b>እንኳን ደስ አለዎ! ምዝገባዎ ተሳክቷል!</b>\n\n` +
            `☕️ <b>ቡና ቢንጎ</b> ቤተሰብ ሆነዋል!\n\n` +
            `🎁 <b>+100.00 ብር (ETB) የእንኳን ደህና ቦነስ</b> ወደ ሂሳብዎ ገቢ ተደርጓል!\n\n` +
            `🎮 ቦነሱን ጨዋታ ለመጫወት ይጠቀሙ።`,
            { parse_mode: 'HTML' }
          );
          logger.info(`[WelcomeBonus] Notified user ${user.id} of 100 ETB welcome bonus`);
        } catch {
          // Non-fatal — just log
          logger.warn(`[WelcomeBonus] Could not send bonus notification to user ${user.id}`);
        }
      }

      // ── Notify referrer (non-blocking) ───────────────────────────────────────
      if (referrer) {
        try {
          await ctx.telegram.sendMessage(
            Number(referrer.telegramId),
            `🎉 <b>የግብዣ ቦነስ አግኝተዋል!</b>\n\n` +
            `<b>${user.firstName}</b> የእርስዎን የግብዣ ሊንክ በመጠቀም ቡና ቢንጎን ተቀላቅለዋል።\n\n` +
            `💰 <b>+5.00 ብር (ETB)</b> ወደ ቦርሳዎ ገቢ ተደርጓል! ☕️`,
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
      return ctx.reply('❌ ስልክ ቁጥርዎን ማስቀመጥ አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
    }
  });


  // ═══════════════════════════════════════════════════════════════════════════
  //  MESSAGE ROUTER — multi-step conversation dispatcher
  //  Priority: deposit → transfer → change_name
  // ═══════════════════════════════════════════════════════════════════════════
  bot.on('message', async (ctx) => {
    // Intercept persistent Amharic reply keyboard buttons
    const text = (ctx.message as any)?.text?.trim();
    if (text) {
      if (text === '🎮 ይጫወቱ') { await handlePlayBingoMenu(ctx); return; }
      if (text === '💰 ሂሳብ') { await handleBalance(ctx); return; }
      if (text === '📥 ገቢ ለማድረግ') { await handleDeposit(ctx); return; }
      if (text === '📤 ወጪ ለማድረግ') { await handleWithdraw(ctx); return; }
      if (text === '🔗 ጋብዝ & አግኝ') { await handleInvite(ctx); return; }
      if (text === '💎 VIP ክፍል') { await handleVipRoom(ctx); return; }
      if (text === '🆘 እርዳታ') { await handleSupport(ctx); return; }
      if (text === '📜 ደንቦች') { await handleInstructions(ctx); return; }
      if (text === '📋 ትዕዛዞች' || text === '/cmd') { await handleCmd(ctx); return; }
    }

    // 1. Deposit flow (text + photo)
    if (await handleDepositMessage(ctx)) return;

    // 2. Withdrawal flow (text only)
    if (await handleWithdrawMessage(ctx)) return;

    // 3. Transfer flow (text only)
    if (await handleTransferMessage(ctx)) return;

    // 4. Change name flow (text only)
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
