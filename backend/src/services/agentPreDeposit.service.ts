import prisma from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '../lib/logger';
import { config } from '../config';
import { getCompanyCommissionRate } from './settings.service';

// ─────────────────────────────────────────────────────────────────────────────
// Agent Pre-Deposit Commission Control System
//
// Business rules:
//   TOTAL_SALES        = sum of all player buy-ins for the game
//   COMPANY_COMMISSION = TOTAL_SALES × 12.5%      ← deducted from this wallet
//   AGENT_GROSS_PROFIT = TOTAL_SALES × 12.5%      ← agent keeps (informational)
//   PLAYER_PRIZE_POOL  = TOTAL_SALES × 75%        ← paid out to winner(s)
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
    create: { agentId, balance: 0 },
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
  // Find the agent for this game (agent = referredBy of any player)
  const ticket = await prisma.ticket.findFirst({
    where: { gameId },
    include: { user: { select: { referredBy: true } } },
  });

  let agentId = ticket?.user?.referredBy ?? null;

  if (!agentId) {
    // Fall back to the first active agent in the system as the default agent
    const defaultAgent = await prisma.user.findFirst({
      where: { role: 'AGENT' },
      orderBy: { createdAt: 'asc' }
    });
    if (defaultAgent) {
      agentId = defaultAgent.id;
      logger.info(`[Commission] Game ${gameId}: no linked agent. Falling back to default agent ${agentId}.`);
    }
  }

  if (!agentId) {
    // No agent linked and no default agent found — game proceeds without commission deduction
    logger.info(`[Commission] Game ${gameId}: no agent and no fallback found, skipping pre-deposit debit.`);
    return null;
  }

  const wallet = await getOrCreateAgentPreDepositWallet(agentId);
  const balance = new Decimal(wallet.balance.toString());
  const rate = await getCompanyCommissionRate();
  const commissionAmount = totalSales.mul(rate);

  // ── Hard block ──────────────────────────────────────────────────────────────
  if (balance.lessThan(commissionAmount)) {
    const msg =
      `Insufficient commission balance. ` +
      `Required: ${commissionAmount.toFixed(2)} ETB, ` +
      `Available: ${balance.toFixed(2)} ETB. ` +
      `Agent must recharge their pre-deposit wallet.`;
    logger.warn(`[Commission] Game ${gameId} BLOCKED for agent ${agentId}: ${msg}`);
    throw new Error(msg);
  }

  const newBalance = balance.sub(commissionAmount);

  // ── Atomic debit + audit log ────────────────────────────────────────────────
  await prisma.$transaction(async (tx) => {
    await tx.agentPreDepositWallet.update({
      where: { agentId },
      data: {
        balance: newBalance,
        totalDebited: new Decimal(wallet.totalDebited.toString()).add(commissionAmount),
        updatedAt: new Date(),
      },
    });

    await tx.agentCommissionLog.create({
      data: {
        agentId,
        walletId: wallet.id,
        type: 'COMMISSION_DEBIT',
        amount: commissionAmount,
        gameId,
        totalSales,
        description: `Company commission (${(rate * 100).toFixed(2)}%) for game ${gameId}`,
        balanceBefore: balance,
        balanceAfter: newBalance,
      },
    });
  });

  logger.info(
    `[Commission] Game ${gameId}: debited ${commissionAmount.toFixed(2)} ETB from agent ${agentId}. ` +
    `Balance: ${balance.toFixed(2)} → ${newBalance.toFixed(2)} ETB`
  );

  // Warn agent if balance is now low
  const state = classifyBalanceState(newBalance);
  if (state === 'RED' || state === 'YELLOW') {
    logger.warn(
      `[Commission] Agent ${agentId} pre-deposit balance is ${state}: ${newBalance.toFixed(2)} ETB remaining.`
    );
  }

  return { agentId, commissionAmount };
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
