/**
 * In-memory session store for multi-step bot conversations.
 * Each user can have one active session at a time.
 */
export type DepositStep = 'AWAITING_AMOUNT' | 'AWAITING_SCREENSHOT' | 'AWAITING_SMS';
export type PaymentMethod = 'cbe_birr' | 'cbe_bank' | 'mpesa' | 'telebirr';
export interface DepositSession {
    type: 'MANUAL_DEPOSIT';
    step: DepositStep;
    amount?: number;
    reference?: string;
    paymentMethod?: PaymentMethod;
}
type Session = DepositSession;
export declare function setSession(telegramId: number, session: Session): void;
export declare function getSession(telegramId: number): Session | undefined;
export declare function clearSession(telegramId: number): void;
export {};
//# sourceMappingURL=session.d.ts.map