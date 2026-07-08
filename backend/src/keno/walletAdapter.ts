/**
 * WalletAdapter is the ONLY way the Keno module touches money.
 * It does not implement wallet logic itself — you wire it to your
 * existing, already-tested wallet/ledger functions.
 *
 * Why this matters for real money safety:
 *  - Keno must never maintain a second source of truth for balances.
 *  - Debit/credit calls MUST be atomic and idempotent on your side
 *    (i.e. calling debit() twice with the same idempotencyKey must not
 *    double-charge — this is what protects against retries, crashes
 *    mid-request, or a player double-tapping "place bet").
 *  - Debit must happen BEFORE the ticket is accepted; if debit fails
 *    (insufficient funds), the ticket must never be created.
 *  - Credit (payout) happens only after the round is settled server-side —
 *    never trust a client-reported win.
 */
import prisma from '../lib/prisma';

export interface WalletAdapter {
  debit(params: {
    userId: string; // Changed to string (UUID)
    amountCents: number;
    idempotencyKey: string;
    reason: string;
  }): Promise<{ ok: boolean; reference: string; newBalanceCents?: number }>;

  credit(params: {
    userId: string; // Changed to string (UUID)
    amountCents: number;
    idempotencyKey: string;
    reason: string;
  }): Promise<{ ok: boolean; reference: string; newBalanceCents?: number }>;

  getBalanceCents(userId: string): Promise<number>;
}

export class RealWalletAdapter implements WalletAdapter {
  async debit(params: {
    userId: string;
    amountCents: number;
    idempotencyKey: string;
    reason: string;
  }): Promise<{ ok: boolean; reference: string; newBalanceCents?: number }> {
    const amountBirr = params.amountCents / 100;
    try {
      return await prisma.$transaction(async (tx) => {
        // ATOMIC LOCK: Lock the wallet row FOR UPDATE first to prevent
        // concurrent bet submissions from racing past the idempotency check
        const [lockedWallet] = await tx.$queryRaw<any[]>`SELECT * FROM wallets WHERE user_id = ${params.userId}::uuid FOR UPDATE`;
        if (!lockedWallet) return { ok: false, reference: params.idempotencyKey };

        // Idempotency guard — now safe inside the lock
        const existingTxn = await tx.transaction.findFirst({
          where: { referenceId: params.idempotencyKey }
        });
        if (existingTxn) {
          return { ok: true, reference: params.idempotencyKey, newBalanceCents: undefined };
        }

        const currentBalance = Number(lockedWallet.balance);
        if (currentBalance < amountBirr) {
          return { ok: false, reference: params.idempotencyKey }; // Insufficient funds
        }

        const newBalance = parseFloat((currentBalance - amountBirr).toFixed(10));
        await tx.wallet.update({
          where: { userId: params.userId },
          data: {
            balance: newBalance,
            totalSpent: { increment: amountBirr }
          }
        });

        await tx.transaction.create({
          data: {
            userId: params.userId,
            type: 'KENO_BET',
            amount: amountBirr,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            referenceId: params.idempotencyKey,
            description: params.reason
          }
        });

        return { ok: true, reference: params.idempotencyKey, newBalanceCents: Math.floor(newBalance * 100) };
      });
    } catch (e) {
      console.error("Wallet debit failed", e);
      return { ok: false, reference: params.idempotencyKey };
    }
  }

  async credit(params: {
    userId: string;
    amountCents: number;
    idempotencyKey: string;
    reason: string;
  }): Promise<{ ok: boolean; reference: string; newBalanceCents?: number }> {
    const amountBirr = params.amountCents / 100;
    try {
      return await prisma.$transaction(async (tx) => {
        // ATOMIC LOCK: Lock the wallet row FOR UPDATE first to prevent
        // concurrent payouts from racing past the idempotency check
        const [lockedWallet] = await tx.$queryRaw<any[]>`SELECT * FROM wallets WHERE user_id = ${params.userId}::uuid FOR UPDATE`;
        if (!lockedWallet) return { ok: false, reference: params.idempotencyKey };

        // Idempotency guard — now safe inside the lock
        const existingTxn = await tx.transaction.findFirst({
          where: { referenceId: params.idempotencyKey }
        });
        if (existingTxn) {
          return { ok: true, reference: params.idempotencyKey, newBalanceCents: undefined };
        }

        const currentBalance = Number(lockedWallet.balance);
        const newBalance = parseFloat((currentBalance + amountBirr).toFixed(10));

        await tx.wallet.update({
          where: { userId: params.userId },
          data: {
            balance: newBalance,
            totalWon: { increment: amountBirr }
          }
        });

        await tx.transaction.create({
          data: {
            userId: params.userId,
            type: 'KENO_WIN',
            amount: amountBirr,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            referenceId: params.idempotencyKey,
            description: params.reason
          }
        });

        return { ok: true, reference: params.idempotencyKey, newBalanceCents: Math.floor(newBalance * 100) };
      });
    } catch (e) {
      console.error("Wallet credit failed", e);
      return { ok: false, reference: params.idempotencyKey };
    }
  }

  async getBalanceCents(userId: string): Promise<number> {
    const wallet = await prisma.wallet.findUnique({
      where: { userId }
    });
    if (!wallet) return 0;
    return Number(wallet.balance) * 100;
  }
}
