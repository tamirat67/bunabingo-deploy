/**
 * In-memory session store for multi-step bot conversations.
 * Each user can have one active session at a time.
 */

// ─── Deposit ──────────────────────────────────────────────────────────────────

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

// ─── Transfer ─────────────────────────────────────────────────────────────────

export type TransferStep =
  | 'AWAITING_RECIPIENT'
  | 'AWAITING_AMOUNT'
  | 'CONFIRMING';

export interface TransferSession {
  type: 'TRANSFER';
  step: TransferStep;
  recipientId?: string;
  recipientName?: string;
  recipientUsername?: string;
  amount?: number;
}

// ─── Change Name ──────────────────────────────────────────────────────────────

export interface ChangeNameSession {
  type: 'CHANGE_NAME';
  step: 'AWAITING_NAME';
}

// ─── Withdrawal ───────────────────────────────────────────────────────────────

export type WithdrawalStep =
  | 'AWAITING_AMOUNT'
  | 'AWAITING_BANK'
  | 'AWAITING_ACCOUNT'
  | 'AWAITING_NAME';

export interface WithdrawalSession {
  type: 'WITHDRAWAL';
  step: WithdrawalStep;
  amount?: number;
  bankName?: string;
  accountNumber?: string;
}

// ─── Union ────────────────────────────────────────────────────────────────────

export type Session = DepositSession | TransferSession | ChangeNameSession | WithdrawalSession;

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
