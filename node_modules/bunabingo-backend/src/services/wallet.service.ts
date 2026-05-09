import prisma from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { triggerUserEvent, triggerAdminEvent } from '../lib/pusher';
import { logger } from '../lib/logger';

export async function getOrCreateWallet(userId: string) {
  return prisma.wallet.upsert({
    where: { userId },
    create: { userId, balance: 0 },
    update: {},
  });
}

export async function getBalance(userId: string): Promise<Decimal> {
  const wallet = await getOrCreateWallet(userId);
  return wallet.balance as unknown as Decimal;
}

export async function creditWallet(
  userId: string,
  amount: number | Decimal,
  type: 'DEPOSIT' | 'PRIZE_WIN' | 'REFUND',
  referenceId?: string,
  description?: string
): Promise<void> {
  const wallet = await getOrCreateWallet(userId);
  const amt = new Decimal(amount.toString());
  const newBalance = new Decimal(wallet.balance.toString()).add(amt);

  await prisma.wallet.update({
    where: { userId },
    data: {
      balance: newBalance,
      totalDeposited: type === 'DEPOSIT'
        ? new Decimal(wallet.totalDeposited.toString()).add(amt)
        : wallet.totalDeposited,
      totalWon: type === 'PRIZE_WIN'
        ? new Decimal(wallet.totalWon.toString()).add(amt)
        : wallet.totalWon,
    },
  });

  await prisma.transaction.create({
    data: {
      userId,
      type,
      amount: amt,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      status: 'COMPLETED',
      referenceId,
      description,
    },
  });

  await triggerUserEvent(userId, 'balance-updated', { newBalance: newBalance.toFixed(2) });
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

  if (balance.lessThan(amt)) {
    throw new Error(`Insufficient balance. Available: ${balance.toFixed(2)}, Required: ${amt.toFixed(2)}`);
  }

  const newBalance = balance.sub(amt);

  await prisma.wallet.update({
    where: { userId },
    data: {
      balance: newBalance,
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
      userId,
      type,
      amount: amt,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      status: 'COMPLETED',
      referenceId,
      description,
    },
  });

  await triggerUserEvent(userId, 'balance-updated', { newBalance: newBalance.toFixed(2) });
}
