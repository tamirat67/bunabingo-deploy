import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function run() {
  console.log('--- STARTING RETROACTIVE FINANCIAL CORRECTION SCRIPT ---');

  // Fetch all logs that might be affected
  const logs = await prisma.agentCommissionLog.findMany({
    where: {
      type: { in: ['COMMISSION_DEBIT', 'BOT_WIN_DEBT_ADDED'] }
    },
    include: {
      agentPreDepositWallet: true,
      agent: { select: { firstName: true } }
    }
  });

  console.log(`Found ${logs.length} commission/debt logs to verify.`);

  let totalRefunded = new Decimal(0);
  let totalDebtReduced = new Decimal(0);
  let agentsRefunded: Record<string, Decimal> = {};

  for (const log of logs) {
    if (!log.gameId || !log.totalSales || log.totalSales.lte(0)) continue;

    // Determine the true real cash spent depending on the log type
    let trueRealCash = new Decimal(0);

    if (log.type === 'COMMISSION_DEBIT') {
      // Commission was based on ALL real player tickets in the game
      const allRealPurchases = await prisma.transaction.findMany({
        where: {
          type: 'TICKET_PURCHASE',
          referenceId: log.gameId,
          user: { isBot: false },
          status: { in: ['completed', 'COMPLETED'] }
        }
      });
      trueRealCash = allRealPurchases.reduce((sum, tx) => sum.add(tx.balanceBefore.sub(tx.balanceAfter)), new Decimal(0));
    } 
    else if (log.type === 'BOT_WIN_DEBT_ADDED') {
      // Bot debt was based on tickets sold SPECIFICALLY by this agent
      const agentPurchases = await prisma.transaction.findMany({
        where: {
          type: 'TICKET_PURCHASE',
          referenceId: log.gameId,
          user: { isBot: false, referredBy: log.agentId },
          status: { in: ['completed', 'COMPLETED'] }
        }
      });
      trueRealCash = agentPurchases.reduce((sum, tx) => sum.add(tx.balanceBefore.sub(tx.balanceAfter)), new Decimal(0));
    }

    // Only fix if the true real cash is LESS than the totalSales recorded in the log (meaning bonus was used)
    if (trueRealCash.lessThan(log.totalSales)) {
      // Calculate the effective rate used at the time (e.g., 0.20 or 0.70)
      const rate = log.amount.div(log.totalSales);
      const newAmount = trueRealCash.mul(rate);
      
      const difference = log.amount.sub(newAmount);

      if (log.type === 'COMMISSION_DEBIT') {
        // Refund physical wallet balance
        const wallet = log.agentPreDepositWallet;
        if (wallet) {
          const newBalance = wallet.balance.add(difference);
          const newTotalDebited = Decimal.max(0, new Decimal(wallet.totalDebited?.toString() || 0).sub(difference));
          
          await prisma.agentPreDepositWallet.update({
            where: { id: wallet.id },
            data: { 
              balance: newBalance,
              totalDebited: newTotalDebited
            }
          });

          // Track refund totals for reporting
          totalRefunded = totalRefunded.add(difference);
          if (!agentsRefunded[log.agent.firstName || log.agentId]) {
            agentsRefunded[log.agent.firstName || log.agentId] = new Decimal(0);
          }
          agentsRefunded[log.agent.firstName || log.agentId] = agentsRefunded[log.agent.firstName || log.agentId].add(difference);

          console.log(`[REFUND] Game ${log.gameId} | Agent ${log.agent.firstName} | Refunded ${difference.toFixed(2)} ETB to Pre-Deposit Wallet.`);
        }
      } 
      else if (log.type === 'BOT_WIN_DEBT_ADDED') {
        totalDebtReduced = totalDebtReduced.add(difference);
        console.log(`[DEBT REDUCED] Game ${log.gameId} | Agent ${log.agent.firstName} | Reduced outstanding debt by ${difference.toFixed(2)} ETB.`);
      }

      // Update the log to reflect the true mathematically accurate numbers
      await prisma.agentCommissionLog.update({
        where: { id: log.id },
        data: {
          totalSales: trueRealCash,
          amount: newAmount,
          description: log.description + ` (Auto-Corrected: Refunded ${difference.toFixed(2)} ETB from Bonus adjustment)`
        }
      });
    }
  }

  console.log('\n--- CORRECTION COMPLETE ---');
  console.log(`Total Physical ETB Refunded to Agent Wallets: ${totalRefunded.toFixed(2)} ETB`);
  console.log(`Total Fake Bot Debt Wiped: ${totalDebtReduced.toFixed(2)} ETB`);
  
  if (Object.keys(agentsRefunded).length > 0) {
    console.log('\nRefunds per Agent:');
    for (const [name, amt] of Object.entries(agentsRefunded)) {
      console.log(`- ${name}: ${amt.toFixed(2)} ETB`);
    }
  } else {
    console.log('\nNo refunds were necessary. All historical games were clean!');
  }

  await prisma.$disconnect();
}

run().catch(console.error);
