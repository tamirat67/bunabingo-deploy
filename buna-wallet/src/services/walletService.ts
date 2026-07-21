const BASE_URL = 'https://api.bunatechhub.net';

export interface DepositRequestPayload {
  userId: string;
  amount: number;
  txnId: string;
}

export interface DepositResponse {
  success: boolean;
  message: string;
  deposit?: {
    id: string;
    amount: string;
    status: string;
    tx_id: string;
  };
}

export async function requestDeposit(payload: DepositRequestPayload): Promise<DepositResponse> {
  const response = await fetch(`${BASE_URL}/api/wallet/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Deposit request failed');
  }

  return data;
}

export interface WithdrawalRequestPayload {
  userId: string;
  amount: number;
  paymentMethod: string;
  accountNumber: string;
}

export interface WithdrawalResponse {
  success: boolean;
  message: string;
  withdrawalId?: string;
  newBalance?: number;
}

export async function requestWithdrawal(payload: WithdrawalRequestPayload): Promise<WithdrawalResponse> {
  const response = await fetch(`${BASE_URL}/api/wallet/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Withdrawal request failed');
  }

  return data;
}

export interface TransferRequestPayload {
  senderId: string;
  recipientPhone: string;
  amount: number;
}

export interface TransferResponse {
  success: boolean;
  message: string;
  newBalance?: number;
}

export async function requestTransfer(payload: TransferRequestPayload): Promise<TransferResponse> {
  const response = await fetch(`${BASE_URL}/api/wallet/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Transfer failed');
  }

  return data;
}

export interface BridgeRequestPayload {
  userId: string;
  amount: number;
}

export interface BridgeResponse {
  success: boolean;
  message: string;
  newBalance?: number;
}

export async function transferToCasino(payload: BridgeRequestPayload): Promise<BridgeResponse> {
  const response = await fetch(`${BASE_URL}/api/wallet/bridge/to-casino`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Transfer to Casino failed');
  return data;
}

export async function transferToWallet(payload: BridgeRequestPayload): Promise<BridgeResponse> {
  const response = await fetch(`${BASE_URL}/api/wallet/bridge/to-wallet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Transfer to App Wallet failed');
  return data;
}
