import prisma from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '../lib/logger';
import { config } from '../config';
import { getCompanyCommissionRate } from './settings.service';

// ─────────────────────────────────────────────────────────────────────────────
// Agent Pre-Deposit Commission Control System
//
// Business rules:
//   TOTAL_SALES        = sum of all real player buy-ins for the game
//   COMPANY_COMMISSION = TOTAL_SALES × 20%       ← deducted from this wallet
//   AGENT_PROFIT       = TOTAL_SALES × 10%       ← agent keeps as profit
//   PLAYER_PRIZE_POOL  = TOTAL_SALES × 70%       ← paid out to winner(s)
//
// Game start is HARD-BLOCKED if:
//   agentPreDepositBalance < COMPANY_COMMISSION
//
// UI balance state (informational only — no game blocking):
//   GREEN  : balance >= 50% of a "reference buffer" (10_000 ETB)
//   YELLOW : 30% ≤ balance < 50%  → warning
//   RED    : balance < 30%        → critical warning (game still allowed)
// ─────────────────────────────────────────────────────────────────────────────

const REFERENCE_BUFFER = 10_000; // the initial seeded balance used as 100% reference

export type BalanceState = 'GREEN' | 'YELLOW' | 'RED';

export interface AgentPreDepositStatus {
  balance: Decimal;
  state: BalanceState;
  stateMessage: string;
  canCoverCommission: boolean;
  requiredCommission: Decimal;
}

// ─── Seed / get wallet ────────────────────────────────────────────────────────
/**
 * Ensures an AgentPreDepositWallet exists for the given agent.
 * Called on agent promotion and on first access. Starting balance = 10,000 ETB.
 */
export async function getOrCreateAgentPreDepositWallet(agentId: string) {
  return prisma.agentPreDepositWallet.upsert({
    where: { agentId },
    create: { agentId, balance: 10_000 },
    update: {},
  });
}

// ─── Balance state classification ─────────────────────────────────────────────
export function classifyBalanceState(balance: Decimal): BalanceState {
  const pct = balance.div(REFERENCE_BUFFER).mul(100).toNumber();
  if (pct >= 50) return 'GREEN';
  if (pct >= 30) return 'YELLOW';
  return 'RED';
}

function stateMessage(state: BalanceState): string {
  switch (state) {
    case 'GREEN':  return 'Agent pre-deposit balance is healthy.';
    case 'YELLOW': return 'Agent balance is low. Recharge recommended.';
    case 'RED':    return 'Critical: Agent pre-deposit balance is very low. Immediate recharge required.';
  }
}

// ─── Status snapshot ──────────────────────────────────────────────────────────
/**
 * Returns the full status for a given agent and a particular total-sales figure.
 * totalSales is optional — when not provided, requiredCommission is shown as 0.
 */
export async function getAgentPreDepositStatus(
  agentId: string,
  totalSales: Decimal = new Decimal(0)
): Promise<AgentPreDepositStatus> {
  const wallet = await getOrCreateAgentPreDepositWallet(agentId);
  const balance = new Decimal(wallet.balance.toString());
  const rate = await getCompanyCommissionRate();
  const requiredCommission = totalSales.mul(rate);
  const state = classifyBalanceState(balance);

  return {
    balance,
    state,
    stateMessage: stateMessage(state),
    canCoverCommission: balance.greaterThanOrEqualTo(requiredCommission),
    requiredCommission,
  };
}

// ─── Game-start commission check + debit ──────────────────────────────────────
/**
 * Called inside runGame() BEFORE the game is allowed to proceed.
 *
 * 1. Finds the agent for the game (via any ticket's user.referredBy).
 * 2. Calculates company commission (totalSales × 12.5%).
 * 3. Hard-blocks if balance < commission.
 * 4. Deducts commission and writes an audit log.
 *
 * Returns { agentId, commissionAmount } on success.
 * Throws an Error with a user-facing message if blocked.
 */
export async function debitAgentCommissionForGame(
  gameId: string,
  totalSales: Decimal
): Promise<{ agentId: string; commissionAmount: Decimal } | null> {
  // 1. Fetch all tickets for this game
  const tickets = await prisma.ticket.findMany({
    where: { gameId },
    include: {
      user: {
        select: {
          id: true,
          isBot: true,
          referredBy: true,
          firstName: true,
        }
      }
    }
  });

  if (tickets.length === 0) {
    logger.info(`[Commission] Game ${gameId}: no tickets found, skipping pre-deposit debit.`);
    return null;
  }

  // Get the game's room to find the ticket price
  const gameObj = await prisma.game.findUnique({
    where: { id: gameId },
    include: { room: { select: { ticketPrice: true } } }
  });
  if (!gameObj) {
    logger.warn(`[Commission] Game ${gameId} not found, skipping pre-deposit debit.`);
    return null;
  }
  const ticketPrice = new Decimal(gameObj.room.ticketPrice.toString());

  // 2. Calculate TOTAL sales from ALL tickets (real players + house bots)
  const totalAllSales = ticketPrice.mul(tickets.length);

  // 3. Find the agent for this game from REAL player referrals
  //    (bots don't have referrers — we attribute ALL sales to the real-player agent)
  let gameAgentId: string | null = null;

  for (const ticket of tickets) {
    if (ticket.user?.isBot) continue; // bots don't identify the agent
    let agentId = ticket.user?.referredBy ?? null;
    if (agentId) {
      const agentUser = await prisma.user.findUnique({
        where: { id: agentId },
        select: { role: true }
      });
      if (agentUser?.role === 'AGENT' || agentUser?.role === 'ADMIN') {
        gameAgentId = agentId;
        break; // use the first valid agent found
      }
    }
  }

  if (!gameAgentId) {
    logger.info(`[Commission] Game ${gameId}: no agent associated with any real player, skipping pre-deposit debit.`);
    return null;
  }

  const rate = await getCompanyCommissionRate();
  const wallet = await getOrCreateAgentPreDepositWallet(gameAgentId);
  const balance = new Decimal(wallet.balance.toString());

  // Commission = 30% of ALL ticket sales (real + bot)
  const commission = totalAllSales.mul(rate);

  // 4. Hard-block if insufficient balance
  if (balance.lessThan(commission)) {
    const agentUser = await prisma.user.findUnique({
      where: { id: gameAgentId },
      select: { firstName: true }
    });
    const agentName = agentUser?.firstName || 'Agent';
    const msg =
      `Insufficient commission balance for agent ${agentName}. ` +
      `Required: ${commission.toFixed(2)} ETB (${(rate * 100).toFixed(0)}% of ${totalAllSales.toFixed(2)} ETB total sales), ` +
      `Available: ${balance.toFixed(2)} ETB. ` +
      `Agent must recharge their pre-deposit wallet.`;
    logger.warn(`[Commission] Game ${gameId} BLOCKED: ${msg}`);
    throw new Error(msg);
  }

  // 5. Deduct and audit
  const newBalance = balance.sub(commission);

  await prisma.$transaction(async (tx) => {
    await tx.agentPreDepositWallet.update({
      where: { agentId: gameAgentId! },
      data: {
        balance: newBalance,
        totalDebited: new Decimal(wallet.totalDebited.toString()).add(commission),
        updatedAt: new Date(),
      },
    });

    await tx.agentCommissionLog.create({
      data: {
        agentId: gameAgentId!,
        walletId: wallet.id,
        type: 'COMMISSION_DEBIT',
        amount: commission,
        gameId,
        totalSales: totalAllSales,
        description: `Company commission (${(rate * 100).toFixed(0)}%) for game ${gameId} — ${tickets.length} tickets × ${ticketPrice} ETB = ${totalAllSales.toFixed(2)} ETB total`,
        balanceBefore: balance,
        balanceAfter: newBalance,
      },
    });

    logger.info(
      `[Commission] Game ${gameId}: debited ${commission.toFixed(2)} ETB from agent ${gameAgentId}. ` +
      `(${tickets.length} tickets × ${ticketPrice} ETB = ${totalAllSales.toFixed(2)} ETB total × ${(rate * 100).toFixed(0)}%) ` +
      `Balance: ${balance.toFixed(2)} → ${newBalance.toFixed(2)} ETB`
    );

    const state = classifyBalanceState(newBalance);
    if (state === 'RED' || state === 'YELLOW') {
      logger.warn(`[Commission] Agent ${gameAgentId} pre-deposit balance is ${state}: ${newBalance.toFixed(2)} ETB remaining.`);
    }
  });

  return { agentId: gameAgentId, commissionAmount: commission };
}

// ─── Recharge ─────────────────────────────────────────────────────────────────
/**
 * Admin credits the agent's pre-deposit wallet (manual top-up).
 */
export async function rechargeAgentPreDepositWallet(
  agentId: string,
  amount: number,
  adminId: string
): Promise<Decimal> {
  if (amount <= 0) throw new Error('Recharge amount must be positive');

  const wallet = await getOrCreateAgentPreDepositWallet(agentId);
  const before = new Decimal(wallet.balance.toString());
  const rechargeAmt = new Decimal(amount);
  const after = before.add(rechargeAmt);

  await prisma.$transaction(async (tx) => {
    await tx.agentPreDepositWallet.update({
      where: { agentId },
      data: {
        balance: after,
        totalRecharged: new Decimal(wallet.totalRecharged.toString()).add(rechargeAmt),
        updatedAt: new Date(),
      },
    });

    await tx.agentCommissionLog.create({
      data: {
        agentId,
        walletId: wallet.id,
        type: 'RECHARGE',
        amount: rechargeAmt,
        description: `Manual recharge by admin ${adminId}`,
        balanceBefore: before,
        balanceAfter: after,
      },
    });

    await tx.adminLog.create({
      data: {
        adminId,
        targetUserId: agentId,
        action: 'AGENT_WALLET_RECHARGE',
        details: { amount, before: before.toNumber(), after: after.toNumber() },
      },
    });
  });

  // Notify agent on Telegram (non-blocking)
  try {
    const { notifyAgent } = await import('../bot/notifier');
    await notifyAgent(
      agentId,
      `💰 <b>Wallet Refilled!</b>\n\n` +
      `Your branch pre-deposit wallet has been refilled by the administrator.\n\n` +
      `➕ <b>Amount:</b> ${amount.toLocaleString()} ETB\n` +
      `🏦 <b>New Balance:</b> ${after.toFixed(2)} ETB\n\n` +
      `☕️ <i>Keep the games running!</i>`
    );
  } catch (err) {
    logger.warn(`[Commission] Could not notify agent ${agentId} of recharge.`);
  }

  logger.info(`[Commission] Agent ${agentId} wallet recharged +${amount} ETB by admin ${adminId}. New balance: ${after.toFixed(2)}`);
  return after;
}

// ─── Commission history (scoped to agent) ─────────────────────────────────────
export async function getAgentCommissionHistory(agentId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    prisma.agentCommissionLog.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.agentCommissionLog.count({ where: { agentId } }),
  ]);
  return { logs, total, pages: Math.ceil(total / limit) };
}
