import prisma from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { triggerUserEvent } from '../lib/pusher';
import { logger } from '../lib/logger';

// ── Coins-to-ETB conversion rate ────────────────────────────
export const COINS_PER_ETB = 100; // 100 XP = 1 ETB bonus

// ── XP awarded per event ────────────────────────────────────
export const XP_REWARDS = {
  JOIN_GAME:      10,
  WIN_ROW:        25,
  WIN_COLUMN:     25,
  WIN_DIAGONAL:   35,
  WIN_FOUR_CORNERS: 35,
  WIN_FULL_HOUSE: 100,
  REFER_FRIEND:   50,
  FIRST_DEPOSIT:  30,
};

export const REFERRAL_COMMISSION_PERCENT = 2; // 2% of spend

export async function getOrCreateWallet(userId: string) {
  return prisma.wallet.upsert({
    where: { userId: userId },
    create: { userId: userId, balance: 0 },
    update: {},
  });
}

export async function getBalance(userId: string): Promise<Decimal> {
  const wallet = await getOrCreateWallet(userId);
  return wallet.balance as unknown as Decimal;
}

/** Credit main balance (deposits, prizes, refunds) */
export async function creditWallet(
  userId: string,
  amount: number | Decimal,
  type: 'DEPOSIT' | 'PRIZE_WIN' | 'REFUND' | 'REFERRAL_BONUS',
  referenceId?: string,
  description?: string
): Promise<void> {
  const wallet = await getOrCreateWallet(userId);
  const amt = new Decimal(amount.toString());
  const newBalance = new Decimal(wallet.balance.toString()).add(amt);

  await prisma.wallet.update({
    where: { userId: userId },
    data: {
      balance: newBalance,
      totalDeposited: type === 'DEPOSIT'
        ? new Decimal(wallet.totalDeposited.toString()).add(amt)
        : wallet.totalDeposited,
      totalWon: (type === 'PRIZE_WIN' || type === 'REFERRAL_BONUS')
        ? new Decimal(wallet.totalWon.toString()).add(amt)
        : wallet.totalWon,
    },
  });

  await prisma.transaction.create({
    data: {
      userId: userId,
      type,
      amount: amt,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      status: 'completed',
      referenceId: referenceId,
      description,
    },
  });

  await triggerUserEvent(userId, 'balance-updated', { newBalance: newBalance.toFixed(2) });
}

/** Credit bonusBalance only — used for referral bonus, promos (not withdrawable) */
export async function creditBonus(
  userId: string,
  amount: number | Decimal,
  description: string
): Promise<void> {
  const wallet = await getOrCreateWallet(userId);
  const amt = new Decimal(amount.toString());
  const newBonus = new Decimal(wallet.bonusBalance.toString()).add(amt);

  await prisma.wallet.update({
    where: { userId: userId },
    data: { bonusBalance: newBonus },
  });

  logger.info(`[Bonus] +${amt} ETB bonus → user ${userId}: ${description}`);
  await triggerUserEvent(userId, 'bonus-updated', { bonusBalance: newBonus.toFixed(2) });
}

/** Credit referral commission balance (earned from friend activity) */
export async function creditReferralCommission(
  userId: string,
  amount: number | Decimal,
  description: string,
  fromUserId: string
): Promise<void> {
  const wallet = await getOrCreateWallet(userId);
  const amt = new Decimal(amount.toString());
  const newRefBalance = new Decimal(wallet.referralBalance.toString()).add(amt);
  const newMainBalance = new Decimal(wallet.balance.toString()).add(amt);

  // We add it to main balance so it's withdrawable, 
  // but also track it in referralBalance for statistics.
  await prisma.wallet.update({
    where: { userId: userId },
    data: { 
      balance: newMainBalance,
      referralBalance: newRefBalance,
      totalWon: new Decimal(wallet.totalWon.toString()).add(amt)
    },
  });

  await prisma.transaction.create({
    data: {
      userId: userId,
      type: 'REFERRAL_COMMISSION',
      amount: amt,
      balanceBefore: wallet.balance,
      balanceAfter: newMainBalance,
      status: 'completed',
      referenceId: fromUserId,
      description,
    },
  });

  logger.info(`[Referral] +${amt} ETB commission → user ${userId} from player ${fromUserId}`);
  await triggerUserEvent(userId, 'balance-updated', { newBalance: newMainBalance.toFixed(2) });
}

/** Award XP coins to a user */
export async function awardCoins(
  userId: string,
  coins: number,
  reason: string
): Promise<void> {
  const wallet = await getOrCreateWallet(userId);
  const newCoins = wallet.coins + coins;

  await prisma.wallet.update({
    where: { userId: userId },
    data: { coins: newCoins },
  });

  logger.info(`[Coins] +${coins} XP → user ${userId}: ${reason}. Total: ${newCoins}`);
  await triggerUserEvent(userId, 'coins-updated', { coins: newCoins, earned: coins, reason });
}

/**
 * Convert XP coins → bonus ETB.
 * Rate: COINS_PER_ETB coins = 1 ETB (added to bonusBalance).
 * Minimum conversion: 100 coins.
 */
export async function convertCoinsToBonus(userId: string): Promise<{
  coinsSpent: number;
  bonusEarned: string;
  newCoins: number;
  newBonus: string;
}> {
  const wallet = await getOrCreateWallet(userId);
  const coins = wallet.coins;

  if (coins < COINS_PER_ETB) {
    throw new Error(`Need at least ${COINS_PER_ETB} coins to convert. You have ${coins}.`);
  }

  // Floor to nearest 100
  const coinsToSpend = Math.floor(coins / COINS_PER_ETB) * COINS_PER_ETB;
  const bonusEarned = new Decimal(coinsToSpend).div(COINS_PER_ETB);
  const newCoins = coins - coinsToSpend;
  const newBonus = new Decimal(wallet.bonusBalance.toString()).add(bonusEarned);

  await prisma.wallet.update({
    where: { userId: userId },
    data: { coins: newCoins, bonusBalance: newBonus },
  });

  logger.info(`[Coins→Bonus] User ${userId}: ${coinsToSpend} XP → ${bonusEarned} ETB bonus`);
  await triggerUserEvent(userId, 'coins-converted', {
    coinsSpent: coinsToSpend,
    bonusEarned: bonusEarned.toFixed(2),
    newCoins,
    newBonus: newBonus.toFixed(2),
  });

  return {
    coinsSpent: coinsToSpend,
    bonusEarned: bonusEarned.toFixed(2),
    newCoins,
    newBonus: newBonus.toFixed(2),
  };
}

export async function debitWallet(
  userId: string,
  amount: number | Decimal,
  type: 'WITHDRAWAL' | 'TICKET_PURCHASE',
  referenceId?: string,
  description?: string
): Promise<void> {
  const wallet = await getOrCreateWallet(userId);
  const amt = new Decimal(amount.toString());
  const balance = new Decimal(wallet.balance.toString());
  const bonus = new Decimal(wallet.bonusBalance.toString());
  const totalAvailable = type === 'TICKET_PURCHASE' ? balance.add(bonus) : balance;

  if (totalAvailable.lessThan(amt)) {
    throw new Error(`Insufficient funds. Required: ${amt.toFixed(2)} ETB`);
  }

  let remainingToDebit = amt;
  let newBalance = balance;
  let newBonus = bonus;

  if (type === 'TICKET_PURCHASE') {
    // Use main balance first
    if (balance.greaterThan(0)) {
      const balanceToUse = Decimal.min(balance, remainingToDebit);
      newBalance = balance.sub(balanceToUse);
      remainingToDebit = remainingToDebit.sub(balanceToUse);
    }
    
    // Use bonus for the remainder
    if (remainingToDebit.greaterThan(0)) {
      if (bonus.greaterThanOrEqualTo(remainingToDebit)) {
        newBonus = bonus.sub(remainingToDebit);
        remainingToDebit = new Decimal(0);
      } else {
        // This case should ideally not be reached because of the totalAvailable check above,
        // but it's good for safety.
        throw new Error('Insufficient total funds');
      }
    }
  } else {
    // Withdrawal: ONLY use main balance
    newBalance = balance.sub(remainingToDebit);
  }

  await prisma.wallet.update({
    where: { userId: userId },
    data: {
      balance: newBalance,
      bonusBalance: newBonus,
      totalWithdrawn: type === 'WITHDRAWAL'
        ? new Decimal(wallet.totalWithdrawn.toString()).add(amt)
        : wallet.totalWithdrawn,
      totalSpent: type === 'TICKET_PURCHASE'
        ? new Decimal(wallet.totalSpent.toString()).add(amt)
        : wallet.totalSpent,
    },
  });

  await prisma.transaction.create({
    data: {
      userId: userId,
      type,
      amount: amt,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      status: 'completed',
      referenceId: referenceId,
      description,
    },
  });

  await triggerUserEvent(userId, 'balance-updated', { newBalance: newBalance.toFixed(2) });
}


