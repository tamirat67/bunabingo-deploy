import { Context } from 'telegraf';
import { Message } from 'telegraf/types';
export declare function handleDepositManualStart(ctx: Context): Promise<Message.TextMessage>;
export declare function handleDepositCancel(ctx: Context): Promise<void>;
export declare function handleDepositSubmit(ctx: Context): Promise<void>;
export declare function handleDepositMessage(ctx: Context): Promise<boolean>;
export declare function handlePayCbeBirr(ctx: Context): Promise<void>;
export declare function handlePayCbeBank(ctx: Context): Promise<void>;
export declare function handlePayMpesa(ctx: Context): Promise<void>;
export declare function handlePayTelebirr(ctx: Context): Promise<void>;
//# sourceMappingURL=depositFlow.d.ts.map