import { Decimal } from '@prisma/client/runtime/library';
export declare function getOrCreateWallet(userId: string): Promise<{
    id: string;
    updatedAt: Date;
    userId: string;
    balance: Decimal;
    credit: Decimal;
    commissionRate: Decimal;
    referralBalance: Decimal;
    bonusBalance: Decimal;
    freeSpins: number;
    totalWon: Decimal;
    totalSpent: Decimal;
}>;
export declare function getBalance(userId: string): Promise<Decimal>;
export declare function creditWallet(userId: string, amount: number | Decimal, type: string, referenceId?: string, description?: string): Promise<void>;
export declare function debitWallet(userId: string, amount: number | Decimal, type: string, referenceId?: string, description?: string): Promise<void>;
//# sourceMappingURL=wallet.service.d.ts.map