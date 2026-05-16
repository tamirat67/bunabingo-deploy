import { PrismaClient } from '@prisma/client';
import { verifyReceiptOnline } from '../services/bunafrankValidator';
import { approveDeposit } from '../services/deposit.service';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();

async function checkSpecificDeposit() {
  const txnId = 'DEH53HTAPL';
  console.log(`Checking status of transaction: ${txnId}`);

  const deposit = await prisma.deposit.findUnique({
    where: { txnId },
    include: { user: true }
  });

  if (!deposit) {
    console.log('❌ Deposit not found in database.');
    return;
  }

  console.log('✅ Deposit found:', {
    id: deposit.id,
    amount: deposit.amount,
    status: deposit.status,
    userId: deposit.userId,
    userName: deposit.user?.username || deposit.user?.firstName
  });

  if (deposit.status === 'pending') {
    console.log('Attempting to verify online...');
    const receiptUrl = `https://transactioninfo.ethiotelecom.et/receipt/${txnId}`;
    const verified = await verifyReceiptOnline(receiptUrl, txnId);

    if (verified) {
      console.log('✅ Online verification successful! Approving deposit...');
      const adminId = 'ae913951-f2a1-40fd-bf4a-2cbd4b1811f0'; // System Admin ID from verifier job
      await approveDeposit(deposit.id, adminId);
      console.log('🚀 Deposit approved and credited to user.');
    } else {
      console.log('❌ Online verification failed. It may take a few minutes for the bank to index the receipt.');
    }
  } else {
    console.log(`Deposit already has status: ${deposit.status}`);
  }
}

checkSpecificDeposit()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
