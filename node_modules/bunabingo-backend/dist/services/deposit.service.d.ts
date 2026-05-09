export declare function createDepositRequest(userId: string, amount: number, reference?: string, screenshotUrl?: string): Promise<{
    user: {
        username: string;
        firstName: string;
    };
} & {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string | null;
    amount: import("@prisma/client/runtime/library").Decimal;
    reference: string;
    receiptUrl: string | null;
    details: string | null;
}>;
export declare function approveDeposit(depositId: string, adminId: string): Promise<void>;
export declare function rejectDeposit(depositId: string, adminId: string, reason: string): Promise<void>;
export declare function getPendingDeposits(): Promise<({
    user: {
        telegramId: bigint;
        username: string;
        firstName: string;
    };
} & {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string | null;
    amount: import("@prisma/client/runtime/library").Decimal;
    reference: string;
    receiptUrl: string | null;
    details: string | null;
})[]>;
export declare function getUserDeposits(userId: string): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string | null;
    amount: import("@prisma/client/runtime/library").Decimal;
    reference: string;
    receiptUrl: string | null;
    details: string | null;
}[]>;
//# sourceMappingURL=deposit.service.d.ts.map