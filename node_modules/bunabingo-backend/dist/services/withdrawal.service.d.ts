import { Decimal } from '@prisma/client/runtime/library';
export declare function createWithdrawalRequest(userId: string, amount: number, accountName: string, accountNumber: string, bankName: string): Promise<{
    user: {
        telegramUsername: string;
        firstName: string;
    };
} & {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    amount: Decimal;
    accountName: string;
    accountNumber: string;
    bankName: string;
    adminNote: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    processedAt: Date | null;
}>;
export declare function approveWithdrawal(withdrawalId: string, adminId: string): Promise<void>;
export declare function rejectWithdrawal(withdrawalId: string, adminId: string, reason: string): Promise<void>;
export declare function getPendingWithdrawals(): Promise<({
    user: {
        telegramId: bigint;
        telegramUsername: string;
        firstName: string;
    };
} & {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    amount: Decimal;
    accountName: string;
    accountNumber: string;
    bankName: string;
    adminNote: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    processedAt: Date | null;
})[]>;
export declare function getUserWithdrawals(userId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    amount: Decimal;
    accountName: string;
    accountNumber: string;
    bankName: string;
    adminNote: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    processedAt: Date | null;
}[]>;
//# sourceMappingURL=withdrawal.service.d.ts.map