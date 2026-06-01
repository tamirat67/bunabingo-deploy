import prisma from '../lib/prisma';
import { debitWallet, creditWallet } from './wallet.service';
import { triggerAdminEvent, triggerUserEvent } from '../lib/pusher';
import { logger } from '../lib/logger';
import { notifyAgent, notifyUser, notifySuperAdmin } from '../bot/notifier';
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
//   • The APPROVING AGENT'S AgentPreDepositWallet is CREDITED the same amount
//     (they paid out physical cash via Telebirr; this reimburses their digital balance).
//   • AgentCommissionLog entry 'WITHDRAWAL_REIMBURSE' is recorded for full audit.
//   • Player is notified on Telegram.
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
  if (amount < 200) {
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

  // 4. Anti-abuse guard: must play 5+ games AND win at least 1 game
  const [gamesPlayed, winsCount] = await Promise.all([
    prisma.ticket.groupBy({ where: { userId }, by: ['gameId'] }),
    prisma.winner.count({ where: { userId } })
  ]);

  if (gamesPlayed.length < 5) {
    throw new Error(
      `Anti-Abuse: You must play at least 5 games before requesting a withdrawal. ` +
      `You have played ${gamesPlayed.length} game(s).`
    );
  }

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

  // ─── Notify @Luel1616 (super-admin) via Telegram + web ─────────────────
  await notifySuperAdmin(withdrawalMsg, withdrawalButtons);

  // ─── Trigger web dashboard admin event ────────────────────────────────────
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

  // ─── Notify the referring agent (if applicable) ───────────────────────────
  if (withdrawal.user?.referredBy) {
    const agent = await prisma.user.findUnique({
      where: { id: withdrawal.user.referredBy },
      select: { role: true, id: true, firstName: true }
    });
    if (agent && (agent.role === 'AGENT' || agent.role === 'ADMIN')) {
      await notifyAgent(agent.id, withdrawalMsg, withdrawalButtons);
    }
  }

  return withdrawal;
}

// ─────────────────────────────────────────────────────────────────────────────
// APPROVE WITHDRAWAL
// Agent physically sends cash via Telebirr to the player. Upon clicking Approve:
//  1. Withdrawal record → 'approved'
//  2. Player's pending WITHDRAWAL transaction → 'completed'
//  3. Player's totalWithdrawn stat is incremented
//  4. Agent's AgentPreDepositWallet is CREDITED (reimburse the physical payout)
//  5. Full audit trail in AgentCommissionLog
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

    // 4. Determine which agent to reimburse:
    //    - First try the player's referring agent
    //    - Fall back to the admin who approved (if they are an AGENT/ADMIN)
    //    - Finally fall back to the first agent in the system
    let agentToReimburseId: string | null = null;

    if (withdrawal.user?.referredBy) {
      const referringAgent = await tx.user.findUnique({
        where: { id: withdrawal.user.referredBy },
        select: { id: true, role: true }
      });
      if (referringAgent && (referringAgent.role === 'AGENT' || referringAgent.role === 'ADMIN')) {
        agentToReimburseId = referringAgent.id;
      }
    }

    if (!agentToReimburseId && !adminId.startsWith('tg_superadmin_')) {
      const approvingUser = await tx.user.findUnique({
        where: { id: adminId },
        select: { id: true, role: true }
      });
      if (approvingUser && (approvingUser.role === 'AGENT' || approvingUser.role === 'ADMIN')) {
        agentToReimburseId = approvingUser.id;
      }
    }

    if (!agentToReimburseId) {
      const fallbackAgent = await tx.user.findFirst({
        where: { role: 'AGENT' },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
      });
      if (fallbackAgent) agentToReimburseId = fallbackAgent.id;
    }

    // Note: The agent's AgentPreDepositWallet is NO LONGER credited here.
    // The pre-deposit wallet is strictly used for the 25% per-game company commission.


    // 7. Admin audit log (skip for telegram super-admin placeholder)
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
            reimbursedAgent: agentToReimburseId,
          },
        },
      });
    }
  });

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
  const withdrawals = await prisma.withdrawal.findMany({
    where: { 
      status: { in: ['pending', 'PENDING'] },
      user: agentId ? { referredBy: agentId } : undefined
    },
    include: { 
      user: { 
        include: { 
          wallet: true 
        } 
      } 
    },
    orderBy: { createdAt: 'asc' },
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
