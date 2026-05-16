import prisma from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '../lib/logger';

export interface AuditResult {
  userId: string;
  username: string;
  currentBalance: number;
  calculatedBalance: number;
  difference: number;
  status: 'MATCH' | 'MISMATCH';
}

/**
 * Audits a single user's wallet by recalculating balance from transaction history.
 */
export async function auditUserWallet(userId: string): Promise<AuditResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallet: true }
  });

  if (!user || !user.wallet) {
    throw new Error('User or wallet not found');
  }

  const transactions = await prisma.transaction.findMany({
    where: { userId, status: 'completed' }
  });

  let calculated = new Decimal(0);

  for (const tx of transactions) {
    const amt = new Decimal(tx.amount.toString());
    
    // Logic: 
    // DEPOSIT, PRIZE_WIN, REFUND, REFERRAL_BONUS -> ADD to Main Balance
    // WITHDRAWAL, TICKET_PURCHASE -> SUBTRACT from Main Balance
    // Note: This logic assumes all TICKET_PURCHASE came from main balance in logs, 
    // but our debitWallet uses bonus too. 
    // For a strict audit, we would need to log exactly how much was taken from main vs bonus.
    
    if (['DEPOSIT', 'PRIZE_WIN', 'REFUND', 'REFERRAL_BONUS'].includes(tx.type)) {
      calculated = calculated.add(amt);
    } else if (['WITHDRAWAL', 'TICKET_PURCHASE'].includes(tx.type)) {
      calculated = calculated.sub(amt);
    }
  }

  const current = new Decimal(user.wallet.balance.toString());
  const diff = calculated.sub(current);

  return {
    userId,
    username: user.username || user.firstName || 'User',
    currentBalance: current.toNumber(),
    calculatedBalance: calculated.toNumber(),
    difference: diff.toNumber(),
    status: diff.isZero() ? 'MATCH' : 'MISMATCH'
  };
}

/**
 * Audits all wallets in the system.
 */
export async function auditAllWallets(): Promise<AuditResult[]> {
  const wallets = await prisma.wallet.findMany({
    select: { userId: true }
  });

  const results: AuditResult[] = [];
  for (const w of wallets) {
    try {
      const res = await auditUserWallet(w.userId);
      if (res.status === 'MISMATCH') {
        results.push(res);
      }
    } catch (err) {
      logger.error(`Audit failed for user ${w.userId}:`, err);
    }
  }

  return results;
}

/**
 * Syncs a user's wallet balance to the calculated transaction total.
 * Use with caution!
 */
export async function syncUserWallet(userId: string, adminId: string): Promise<void> {
  const audit = await auditUserWallet(userId);
  if (audit.status === 'MATCH') return;

  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { userId },
      data: { balance: audit.calculatedBalance }
    });

    await tx.adminLog.create({
      data: {
        adminId,
        targetUserId: userId,
        action: 'SYNC_WALLET',
        details: {
          before: audit.currentBalance,
          after: audit.calculatedBalance,
          reason: 'Manual Audit Sync'
        }
      }
    });
  });

  logger.info(`[Audit] Synced wallet for user ${userId} (from ${audit.currentBalance} to ${audit.calculatedBalance})`);
}
