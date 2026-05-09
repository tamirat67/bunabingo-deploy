import { Context } from 'telegraf';
export declare function handleAdminPanel(ctx: Context): Promise<import("@telegraf/types").Message.TextMessage>;
export declare function handleAdminDeposits(ctx: Context): Promise<import("@telegraf/types").Message.TextMessage>;
export declare function handleAdminWithdrawals(ctx: Context): Promise<import("@telegraf/types").Message.TextMessage>;
export declare function handleApproveDeposit(ctx: Context, depositId: string): Promise<void>;
export declare function handleRejectDeposit(ctx: Context, depositId: string): Promise<void>;
export declare function handleApproveWithdrawal(ctx: Context, withdrawalId: string): Promise<void>;
export declare function handleRejectWithdrawal(ctx: Context, withdrawalId: string): Promise<void>;
//# sourceMappingURL=admin.d.ts.map