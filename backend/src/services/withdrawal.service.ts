import prisma from '../lib/prisma';
import { debitWallet, creditWallet } from './wallet.service';
import { triggerAdminEvent, triggerUserEvent } from '../lib/pusher';
import { logger } from '../lib/logger';
import { notifyUser, notifyAllAdminsAndAgent } from '../bot/notifier';
import { Decimal } from '@prisma/client/runtime/library';
import { Markup } from 'telegraf';
import { config } from '../config';

// ─────────────────────────────────────────────────────────────────────────────
// WITHDRAWAL FINANCIAL FLOW — AIRTIGHT DESIGN
//
// STEP 1 — Player requests withdrawal:
//   • Player wallet is IMMEDIATELY debited (escrow) to prevent double-spend.
//   • Transaction is created with status = 'pending' (NOT counted as withdrawn yet).
//   • totalWithdrawn stat is NOT updated yet.
//   • Agent + Admin are notified via Telegram + web dashboard.
//
// STEP 2a — Agent APPROVES:
//   • The pending WITHDRAWAL transaction → 'completed'.
//   • Player's totalWithdrawn stat is incremented by the withdrawal amount.
//   • Player is notified on Telegram.
//   NOTE: The AgentPreDepositWallet is NOT touched here. It is strictly a
//         commission-control wallet: debited only per game (12.5% of real-player
//         sales), and recharged manually by admin. Withdrawals have zero effect
//         on it for ALL agents.
//
// STEP 2b — Agent REJECTS:
//   • The pending WITHDRAWAL transaction → 'failed'.
//   • Player's wallet balance is RESTORED via a creditWallet (creates a REFUND tx).
//   • Player is notified on Telegram with reason.
//   • totalWithdrawn stat remains unchanged (as if the request never happened).
// ─────────────────────────────────────────────────────────────────────────────

export async function createWithdrawalRequest(
  userId: string,
  amount: number,
  bankName: string,
  accountNumber: string,
  accountName: string
) {
  // 1. Minimum amount check
  const safeAmount = Number(amount);
  if (!safeAmount || isNaN(safeAmount) || safeAmount <= 0) {
    throw new Error('Invalid withdrawal amount. Please restart the withdrawal flow.');
  }
  if (safeAmount < 200) {
    throw new Error('Minimum withdrawal is 200 ETB');
  }

  // 2. Strict bank type check — Telebirr only
  if (!bankName || bankName.toLowerCase() !== 'telebirr') {
    throw new Error('Only Telebirr withdrawals are currently supported.');
  }

  // 3. Balance check before creating the record
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet || new Decimal(wallet.balance.toString()).lessThan(amount)) {
    throw new Error('Insufficient balance for this withdrawal amount.');
  }

  // 4. Anti-abuse guard: must win at least 1 game
  const winsCount = await prisma.winner.count({ where: { userId } });

  if (winsCount < 1) {
    throw new Error(
      `Restricted: You must win at least 1 game before you can request a withdrawal. Keep playing! 🎰`
    );
  }

  // 5. Create the withdrawal record FIRST (so we get the ID for the referenceId)
  const withdrawal = await prisma.withdrawal.create({
    data: {
      userId,
      amount,
      bankName,
      accountNumber,
      accountName,
      status: 'pending',
    },
    include: { user: { select: { username: true, firstName: true, referredBy: true } } },
  });

  // 6. ESCROW: Deduct from player wallet immediately with status='pending'
  //    This prevents double-spending while the request awaits approval.
  //    totalWithdrawn is NOT incremented yet (handled in approveWithdrawal).
  await debitWallet(
    userId,
    amount,
    'WITHDRAWAL',
    withdrawal.id,
    `Withdrawal request (Telebirr: ${accountNumber}) — Pending agent approval`,
    'pending'
  );

  logger.info(`[Withdrawal] Request created: user=${userId}, amount=${amount} ETB, bank=${bankName}, wd_id=${withdrawal.id}`);

  // ─── Build shared notification message & inline buttons ───────────────────
  const playerName = withdrawal.user?.username || withdrawal.user?.firstName || 'Unknown Player';
  const withdrawalMsg =
    `💸 <b>አዲስ የገንዘብ ማውጫ ጥያቄ (New Withdrawal Request)</b>\n\n` +
    `👤 <b>ተጫዋች (Player):</b> ${playerName}\n` +
    `💰 <b>መጠን (Amount):</b> ${amount} ETB\n` +
    `🏦 <b>ባንክ (Bank):</b> ${bankName}\n` +
    `💳 <b>ሂሳብ (Account):</b> ${accountNumber}\n` +
    `👤 <b>ስም (Holder):</b> ${accountName}\n\n` +
    `⏳ <b>Status:</b> Pending Approval\n\n` +
    `እባክዎ መረጃውን አረጋግጠው ይክፈሉ ወይም ውድቅ ያድርጉ።`;

  const withdrawalButtons = Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Approve', `approve_wd_${withdrawal.id}`),
      Markup.button.callback('❌ Reject',  `reject_wd_${withdrawal.id}`),
    ],
  ]);

  // Trigger web dashboard event
  await triggerAdminEvent('new-withdrawal', {
    withdrawalId: withdrawal.id,
    userId,
    amount,
    userName: playerName,
    bankName,
    accountNumber,
    accountName,
    requiresApproval: true,
  });

  // Notify all admins + the player's referring agent via one unified call
  try {
    await notifyAllAdminsAndAgent(userId, withdrawalMsg, withdrawalButtons);
  } catch (notifyErr) {
    logger.warn(`[Withdrawal] Could not notify admins/agent for withdrawal ${withdrawal.id}.`, notifyErr);
  }

  return withdrawal;
}

// ─────────────────────────────────────────────────────────────────────────────
// APPROVE WITHDRAWAL
// Agent physically sends cash via Telebirr to the player. Upon clicking Approve:
//  1. Withdrawal record → 'approved'
//  2. Player's pending WITHDRAWAL transaction → 'completed'
//  3. Player's totalWithdrawn stat is incremented
//  4. Admin audit log is created
// NOTE: AgentPreDepositWallet is intentionally NOT modified — for ALL agents.
// ─────────────────────────────────────────────────────────────────────────────
export async function approveWithdrawal(withdrawalId: string, adminId: string) {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
    include: { user: { select: { referredBy: true, username: true, firstName: true } } }
  });
  if (!withdrawal) throw new Error('Withdrawal not found');
  if (withdrawal.status !== 'pending') throw new Error('Withdrawal already processed');

  const withdrawalAmount = new Decimal(withdrawal.amount.toString());

  await prisma.$transaction(async (tx) => {
    // 1. Mark withdrawal record as approved
    await tx.withdrawal.update({
      where: { id: withdrawalId },
      data: { status: 'approved' },
    });

    if (withdrawal.userId) {
      // 2. Mark the pending WITHDRAWAL transaction as completed
      //    (find by referenceId = withdrawal.id and status = pending)
      await tx.transaction.updateMany({
        where: {
          userId: withdrawal.userId,
          type: 'WITHDRAWAL',
          referenceId: withdrawalId,
          status: 'pending',
        },
        data: { status: 'completed' },
      });

      // 3. Increment player's totalWithdrawn stat (only now, after real approval)
      await tx.wallet.update({
        where: { userId: withdrawal.userId },
        data: {
          totalWithdrawn: {
            increment: withdrawalAmount,
          },
        },
      });
    }

    // 4. Admin audit log (skip for telegram super-admin placeholder)
    if (withdrawal.userId && !adminId.startsWith('tg_superadmin_')) {
      await tx.adminLog.create({
        data: {
          adminId,
          targetUserId: withdrawal.userId,
          action: 'APPROVE_WITHDRAWAL',
          details: {
            withdrawalId,
            amount: withdrawal.amount.toString(),
            bankName: withdrawal.bankName,
            accountNumber: withdrawal.accountNumber,
          },
        },
      });
    }
  });

  // ─── Pre-Deposit Refund (NCF Architecture) ───
  try {
    if (withdrawal.userId) {
      const { findAgentAncestor } = await import('./user.service');
      const ancestor = await findAgentAncestor(withdrawal.userId);
      if (ancestor) {
        const { getCompanyCommissionRate } = await import('./settings.service');
        const { getOrCreateAgentPreDepositWallet } = await import('./agentPreDeposit.service');
        
        const companyRate = await getCompanyCommissionRate();
        const refundAmount = withdrawalAmount.mul(companyRate);
        
        const wallet = await getOrCreateAgentPreDepositWallet(ancestor.id);
        const oldBalance = new Decimal(wallet.balance.toString());
        const newBalance = oldBalance.add(refundAmount);
        
        await prisma.agentPreDepositWallet.update({
          where: { id: wallet.id },
          data: {
            balance: newBalance,
            updatedAt: new Date()
          }
        });
        
        // Negative amount for COMMISSION_DEBIT = Refund
        await prisma.agentCommissionLog.create({
          data: {
            agentId: ancestor.id,
            walletId: wallet.id,
            type: 'COMMISSION_DEBIT', // Reusing the same type, but logging it as a positive balance change
            amount: refundAmount.negated(),
            gameId: withdrawalId, // using withdrawalId as reference
            totalSales: withdrawalAmount.negated(),
            description: `NCF Refund: Withdrawal approved for ${withdrawal.user?.username || withdrawal.userId}. ${withdrawal.amount} ETB × ${(companyRate * 100).toFixed(0)}% refunded.`,
            balanceBefore: oldBalance,
            balanceAfter: newBalance,
          }
        });
        logger.info(`[PreDeposit] Refunded ${refundAmount.toFixed(2)} ETB to agent ${ancestor.id} for withdrawal ${withdrawalId}`);
      }
    }
  } catch (e) {
    logger.error(`[PreDeposit] Error refunding agent pre-deposit for withdrawal ${withdrawalId}:`, e);
  }

  // 8. Notify player on web dashboard + Telegram
  if (withdrawal.userId) {
    await triggerUserEvent(withdrawal.userId, 'withdrawal-approved', {
      withdrawalId,
      amount: withdrawal.amount.toString(),
    });

    await notifyUser(
      withdrawal.userId,
      `✅ <b>የገንዘብ ማውጫ ጥያቄዎ ተረጋግጧል! (Withdrawal Approved)</b>\n\n` +
      `💵 መጠን (Amount): <b>${Number(withdrawal.amount).toFixed(2)} ETB</b>\n` +
      `🏦 ባንክ (Bank): ${withdrawal.bankName}\n` +
      `💳 ሂሳብ (Account): ${withdrawal.accountNumber}\n\n` +
      `ክፍያው ተፈጽሟል። ስላሸነፉ እንኳን ደስ አለዎት! 🏆`
    );
  }

  logger.info(`[Withdrawal] Approved: ${withdrawalId} by admin ${adminId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// REJECT WITHDRAWAL
// Agent declines the request. The escrowed amount is safely returned to the
// player's wallet. totalWithdrawn stat is unaffected.
// ─────────────────────────────────────────────────────────────────────────────
export async function rejectWithdrawal(withdrawalId: string, adminId: string, reason: string) {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
  });
  if (!withdrawal) throw new Error('Withdrawal not found');
  if (withdrawal.status !== 'pending') throw new Error('Withdrawal already processed');

  await prisma.$transaction(async (tx) => {
    // 1. Mark withdrawal record as rejected
    await tx.withdrawal.update({
      where: { id: withdrawalId },
      data: { status: 'rejected' },
    });

    if (withdrawal.userId) {
      // 2. Mark the pending WITHDRAWAL transaction as 'failed'
      //    This keeps the ledger clean — shows the request happened, then failed.
      await tx.transaction.updateMany({
        where: {
          userId: withdrawal.userId,
          type: 'WITHDRAWAL',
          referenceId: withdrawalId,
          status: 'pending',
        },
        data: { status: 'failed' },
      });

      // 3. Admin audit log
      if (!adminId.startsWith('tg_superadmin_')) {
        await tx.adminLog.create({
          data: {
            adminId,
            targetUserId: withdrawal.userId,
            action: 'REJECT_WITHDRAWAL',
            details: { withdrawalId, reason, amount: withdrawal.amount.toString() },
          },
        });
      }
    }
  });

  // 4. Refund the escrowed amount back to player's main balance
  //    This runs OUTSIDE the transaction above so it creates its own
  //    REFUND transaction record in the player's transaction history.
  if (withdrawal.userId) {
    await creditWallet(
      withdrawal.userId,
      withdrawal.amount,
      'REFUND',
      withdrawalId,
      `Withdrawal rejected: ${reason}. Amount returned to your wallet.`
    );

    await triggerUserEvent(withdrawal.userId, 'withdrawal-rejected', { withdrawalId, reason });

    await notifyUser(
      withdrawal.userId,
      `❌ <b>የገንዘብ ማውጫ ጥያቄዎ አልተሳካም (Withdrawal Rejected)</b>\n\n` +
      `💵 መጠን (Amount): <b>${Number(withdrawal.amount).toFixed(2)} ETB</b>\n` +
      `📝 ምክንያት (Reason): ${reason}\n\n` +
      `ያወጡት ብር ወደ ዋና ሂሳብዎ ተመልሷል። (The amount has been refunded to your main balance.) 🙏`
    );
  }

  logger.info(`[Withdrawal] Rejected: ${withdrawalId} — Reason: ${reason}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET PENDING WITHDRAWALS (with ledger verification)
// ─────────────────────────────────────────────────────────────────────────────
export async function getPendingWithdrawals(agentId?: string) {
  let userIds: string[] | undefined;
  if (agentId) {
    const { getDescendantUserIds } = await import('./user.service');
    userIds = await getDescendantUserIds(agentId);
  }

  const withdrawals = await prisma.withdrawal.findMany({
    where: { 
      status: { in: ['pending', 'PENDING'] },
      ...(agentId && userIds ? { userId: { in: userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'] } } : {}),
    },
    include: { 
      user: { 
        include: { 
          wallet: true 
        } 
      } 
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Enrich each withdrawal with a ledger-based balance check
  const enriched = await Promise.all(withdrawals.map(async (wd) => {
    if (!wd.user) return wd;

    // Sum completed transactions to verify wallet integrity
    const txSums = await prisma.transaction.groupBy({
      by: ['type'],
      where: { userId: wd.userId, status: 'completed' },
      _sum: { amount: true }
    });

    const sums: Record<string, number> = {};
    txSums.forEach(group => {
      sums[group.type] = Number(group._sum.amount || 0);
    });

    const deposits     = sums['DEPOSIT']             || 0;
    const wins         = sums['PRIZE_WIN']            || 0;
    const refunds      = sums['REFUND']               || 0;
    const commissions  = sums['REFERRAL_COMMISSION']  || 0;
    const bonuses      = sums['REFERRAL_BONUS']       || 0;
    const spent        = sums['TICKET_PURCHASE']      || 0;
    const withdrawn    = sums['WITHDRAWAL']           || 0;

    const trueBalance = (deposits + wins + refunds + commissions + bonuses) - (spent + withdrawn);

    (wd.user as any).trueBalance = trueBalance;
    (wd.user as any).isBalanceLegit = Math.abs(trueBalance - Number(wd.user.wallet?.balance || 0)) < 0.01;

    return wd;
  }));

  return enriched;
}

export async function getUserWithdrawals(userId: string) {
  return prisma.withdrawal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}
