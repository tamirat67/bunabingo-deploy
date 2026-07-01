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
        // Check if transaction with this idempotency key already exists
        const existingTxn = await tx.transaction.findFirst({
          where: { referenceId: params.idempotencyKey }
        });
        if (existingTxn) {
          return { ok: true, reference: params.idempotencyKey, newBalanceCents: undefined };
        }

        // Update Wallet ATOMICALLY and ensure balance >= amountBirr
        const updateResult = await tx.wallet.updateMany({
          where: { 
            userId: params.userId,
            balance: { gte: amountBirr }
          },
          data: { 
            balance: { decrement: amountBirr },
            totalSpent: { increment: amountBirr }
          }
        });

        if (updateResult.count === 0) {
          return { ok: false, reference: params.idempotencyKey }; // Insufficient funds or user not found
        }

        // We successfully decremented, now fetch the updated wallet to get the new balance
        const updatedWallet = await tx.wallet.findUnique({
          where: { userId: params.userId }
        });

        if (!updatedWallet) {
          throw new Error("Wallet not found after update");
        }

        // Insert Transaction
        await tx.transaction.create({
          data: {
            userId: params.userId,
            type: 'KENO_BET',
            amount: amountBirr,
            balanceBefore: Number(updatedWallet.balance) + amountBirr,
            balanceAfter: updatedWallet.balance,
            referenceId: params.idempotencyKey,
            description: params.reason
          }
        });

        return { ok: true, reference: params.idempotencyKey, newBalanceCents: Number(updatedWallet.balance) * 100 };
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
        const existingTxn = await tx.transaction.findFirst({
          where: { referenceId: params.idempotencyKey }
        });
        if (existingTxn) {
          return { ok: true, reference: params.idempotencyKey, newBalanceCents: undefined };
        }

        // Update Wallet ATOMICALLY
        const updateResult = await tx.wallet.updateMany({
          where: { userId: params.userId },
          data: { 
            balance: { increment: amountBirr },
            totalWon: { increment: amountBirr }
          }
        });

        if (updateResult.count === 0) {
          return { ok: false, reference: params.idempotencyKey }; // user not found
        }

        const updatedWallet = await tx.wallet.findUnique({
          where: { userId: params.userId }
        });

        if (!updatedWallet) {
          throw new Error("Wallet not found after update");
        }

        // Insert Transaction
        await tx.transaction.create({
          data: {
            userId: params.userId,
            type: 'KENO_WIN',
            amount: amountBirr,
            balanceBefore: Number(updatedWallet.balance) - amountBirr,
            balanceAfter: updatedWallet.balance,
            referenceId: params.idempotencyKey,
            description: params.reason
          }
        });

        return { ok: true, reference: params.idempotencyKey, newBalanceCents: Number(updatedWallet.balance) * 100 };
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
