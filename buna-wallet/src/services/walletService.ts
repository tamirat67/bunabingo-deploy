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
