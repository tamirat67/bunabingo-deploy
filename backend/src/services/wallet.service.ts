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
  const amt = new Decimal(amount.toString());

  await prisma.$transaction(async (tx) => {
    // 1. Lock the wallet row FOR UPDATE to prevent race conditions
    // If the wallet doesn't exist, upsert it first outside the lock
    await tx.wallet.upsert({
      where: { userId },
      create: { userId, balance: 0 },
      update: {},
    });
    const [wallet] = await tx.$queryRaw<any[]>`SELECT * FROM wallets WHERE user_id = ${userId}::uuid FOR UPDATE`;


    const currentBalance = new Decimal(wallet.balance.toString());
    const newBalance = currentBalance.add(amt);

    logger.info(`[Wallet] Crediting user ${userId}: +${amt} ETB (${type}). Balance: ${currentBalance} -> ${newBalance}`);

    // 2. Update balance
    await tx.wallet.update({
      where: { userId },
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

    // 3. Create transaction log
    await tx.transaction.create({
      data: {
        userId,
        type,
        amount: amt,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        status: 'completed',
        referenceId,
        description,
      },
    });

    // Push update (non-blocking)
    triggerUserEvent(userId, 'balance-updated', { newBalance: newBalance.toFixed(2) }).catch(() => {});
  });
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

// ── Welcome Bonus ────────────────────────────────────────────
/** Amount of one-time welcome bonus credited to new players on first registration */
export const WELCOME_BONUS_ETB = 100;

/**
 * Awards the one-time 100 ETB welcome bonus to a newly registered user.
 *
 * - Credits `bonusBalance` only (playable, NOT withdrawable).
 * - Idempotent: will not double-credit if called more than once.
 * - Returns `true` when the bonus is granted, `false` if already given.
 */
export async function grantWelcomeBonus(userId: string): Promise<boolean> {
  // ── Idempotency guard ────────────────────────────────────────
  const alreadyGranted = await prisma.transaction.findFirst({
    where: { userId, type: 'WELCOME_BONUS' },
  });
  if (alreadyGranted) {
    logger.info(`[WelcomeBonus] Skipped — already granted to user ${userId}`);
    return false;
  }

  const wallet = await getOrCreateWallet(userId);
  const amt = new Decimal(WELCOME_BONUS_ETB);
  const balanceBefore = new Decimal(wallet.bonusBalance.toString());
  const balanceAfter  = balanceBefore.add(amt);

  await prisma.$transaction(async (tx) => {
    // 1. Credit bonusBalance
    await tx.wallet.update({
      where: { userId },
      data: { bonusBalance: balanceAfter },
    });

    // 2. Record transaction for full audit trail
    await tx.transaction.create({
      data: {
        userId,
        type:          'WELCOME_BONUS',
        amount:        amt,
        balanceBefore: balanceBefore,
        balanceAfter:  balanceAfter,
        status:        'completed',
        description:   'Welcome bonus — new player registration (playable, non-withdrawable)',
      },
    });
  });

  logger.info(`[WelcomeBonus] Granted ${WELCOME_BONUS_ETB} ETB bonus to user ${userId}. bonusBalance: ${balanceBefore} → ${balanceAfter}`);
  await triggerUserEvent(userId, 'bonus-updated', { bonusBalance: balanceAfter.toFixed(2) }).catch(() => {});

  return true;
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
  const newBonusBalance = new Decimal(wallet.bonusBalance.toString()).add(amt);

  // Add to bonusBalance (non-withdrawable, for play only)
  await prisma.wallet.update({
    where: { userId: userId },
    data: { 
      bonusBalance: newBonusBalance,
      referralBalance: newRefBalance,
    },
  });

  await prisma.transaction.create({
    data: {
      userId: userId,
      type: 'REFERRAL_COMMISSION',
      amount: amt,
      balanceBefore: wallet.bonusBalance, // Using bonus balance for context
      balanceAfter: newBonusBalance,
      status: 'completed',
      referenceId: fromUserId,
      description: `${description} (Added to Bonus Wallet)`,
    },
  });

  logger.info(`[Referral] +${amt} ETB bonus commission → user ${userId} from player ${fromUserId}`);
  await triggerUserEvent(userId, 'bonus-updated', { bonusBalance: newBonusBalance.toFixed(2) });
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

/**
 * Debit player wallet.
 *
 * @param txStatus - 'completed' for normal debits; 'pending' for withdrawal escrow
 *                   (the stat totalWithdrawn is NOT updated here for withdrawals —
 *                    it is updated atomically in approveWithdrawal after the agent pays out).
 */
export async function debitWallet(
  userId: string,
  amount: number | Decimal,
  type: 'WITHDRAWAL' | 'TICKET_PURCHASE',
  referenceId?: string,
  description?: string,
  txStatus: 'completed' | 'pending' = 'completed'
): Promise<void> {
  const amt = new Decimal(amount.toString());

  await prisma.$transaction(async (tx) => {
    // 1. Lock the wallet row FOR UPDATE to prevent race conditions
    // Upsert outside the lock if missing
    await tx.wallet.upsert({
      where: { userId },
      create: { userId, balance: 0 },
      update: {},
    });
    const [wallet] = await tx.$queryRaw<any[]>`SELECT * FROM wallets WHERE user_id = ${userId}::uuid FOR UPDATE`;

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
      // Use main balance first (Real Cash - 'Lifeline' Bonus rule)
      if (balance.greaterThan(0)) {
        const balanceToUse = Decimal.min(balance, remainingToDebit);
        newBalance = balance.sub(balanceToUse);
        remainingToDebit = remainingToDebit.sub(balanceToUse);
      }
      // Use bonus balance for the remainder if main balance runs out
      if (remainingToDebit.greaterThan(0)) {
        newBonus = bonus.sub(remainingToDebit);
        remainingToDebit = new Decimal(0);
      }
    } else {
      // WITHDRAWAL: ONLY use main balance (bonus is non-withdrawable)
      newBalance = balance.sub(remainingToDebit);
    }

    // 2. Update wallet balances
    //    NOTE: For WITHDRAWAL, totalWithdrawn is NOT updated here.
    //    It is only updated when the agent approves the payout (approveWithdrawal).
    //    This prevents inflating totalWithdrawn if the request is rejected.
    await tx.wallet.update({
      where: { userId },
      data: {
        balance: newBalance,
        bonusBalance: newBonus,
        totalSpent: type === 'TICKET_PURCHASE'
          ? new Decimal(wallet.totalSpent.toString()).add(amt)
          : wallet.totalSpent,
        // totalWithdrawn intentionally NOT updated here for WITHDRAWAL type
      },
    });

    logger.info(`[Wallet] Debiting user ${userId}: -${amt} ETB (${type}, status=${txStatus}). Balance: ${balance} -> ${newBalance}, Bonus: ${bonus} -> ${newBonus}`);

    // 3. Create transaction log with the given status
    await tx.transaction.create({
      data: {
        userId,
        type,
        amount: amt,
        balanceBefore: balance,
        balanceAfter: newBalance,
        status: txStatus,
        referenceId,
        description,
      },
    });

    triggerUserEvent(userId, 'balance-updated', { newBalance: newBalance.toFixed(2) }).catch(() => {});
  });
}
