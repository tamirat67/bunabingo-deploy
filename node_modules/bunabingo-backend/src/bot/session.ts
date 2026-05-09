/**
 * In-memory session store for multi-step bot conversations.
 * Each user can have one active session at a time.
 */

export type DepositStep =
  | 'AWAITING_AMOUNT'
  | 'AWAITING_SCREENSHOT'   // CBE-Birr, CBE Bank, MPESA
  | 'AWAITING_SMS';         // Telebirr — user pastes SMS receipt text

export type PaymentMethod = 'cbe_birr' | 'cbe_bank' | 'mpesa' | 'telebirr';

export interface DepositSession {
  type: 'MANUAL_DEPOSIT';
  step: DepositStep;
  amount?: number;
  reference?: string;
  paymentMethod?: PaymentMethod;
}

type Session = DepositSession;

const sessions = new Map<number, Session>();

export function setSession(telegramId: number, session: Session): void {
  sessions.set(telegramId, session);
}

export function getSession(telegramId: number): Session | undefined {
  return sessions.get(telegramId);
}

export function clearSession(telegramId: number): void {
  sessions.delete(telegramId);
}
