import { PrismaClient } from '@prisma/client';
import { approveDeposit } from '../services/deposit.service';
import { validateTelebirrSms } from '../services/bunafrankValidator';
import { logger } from '../lib/logger';
import { config } from '../config';

const prisma = new PrismaClient();

export async function processAutomatedDeposits() {
  logger.info('[AutoDeposit] Checking for pending deposits that can be verified...');
  
  const pending = await prisma.deposit.findMany({
    where: { 
      status: 'pending',
      txnId: { not: null } 
    },
    include: { user: true }
  });

  if (pending.length === 0) return;

  const adminId = 'ae913951-f2a1-40fd-bf4a-2cbd4b1811f0'; // System Admin

  for (const d of pending) {
    try {
      // Only Telebirr IDs are currently scrapable via the receipt URL
      // Telebirr IDs are usually 10 characters uppercase alphanumeric like DE84OPTF9M
      const isTelebirrId = /^[A-Z0-9]{10}$/.test(d.txnId || '');
      
      if (isTelebirrId) {
        logger.info(`[AutoDeposit] Attempting auto-verify for Telebirr txn: ${d.txnId}`);
        
        // Construct a dummy SMS text for the validator or just call the scraper directly
        // The validator expects the full SMS text, but we can bypass and use verifyReceiptOnline
        const { verifyReceiptOnline } = await import('../services/bunafrankValidator') as any;
        
        const receiptUrl = `https://transactioninfo.ethiotelecom.et/receipt/${d.txnId}`;
        const verified = await verifyReceiptOnline(receiptUrl, d.txnId);

        if (verified) {
          logger.info(`[AutoDeposit] ✅ Verified! Approving ${d.id}`);
          await approveDeposit(d.id, adminId);
        }
      }
    } catch (err) {
      logger.error(`[AutoDeposit] Error processing ${d.id}:`, err);
    }
  }
}

// If run as a script
if (require.main === module) {
  processAutomatedDeposits()
    .then(() => prisma.$disconnect())
    .catch(console.error);
}
