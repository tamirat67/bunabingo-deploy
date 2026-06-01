import prisma from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { getCompanyCommissionRate } from '../services/settings.service';

// Global BigInt JSON serialization fix
(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};

async function main() {
  const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--execute');
  
  console.log("=====================================================================");
  console.log(`=== COMMISSION AUDIT & PRE-DEPOSIT DATABASE RE-SYNC ===`);
  console.log(`MODE: ${isDryRun ? 'DRY-RUN (No database writes will occur)' : 'EXECUTE (DATABASE WRITES ENABLED)'}`);
  console.log("=====================================================================\n");

  try {
    await prisma.$connect();
    
    // 1. Get all COMMISSION_DEBIT logs
    console.log("Fetching historical commission debit logs...");
    const logs = await prisma.agentCommissionLog.findMany({
      where: { type: 'COMMISSION_DEBIT' },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`Found ${logs.length} commission debit logs.\n`);
    
    const rate = await getCompanyCommissionRate();
    console.log(`Current company commission rate: ${(rate * 100).toFixed(2)}%`);
    
    let totalOriginalAmount = new Decimal(0);
    let totalCorrectedAmount = new Decimal(0);
    let totalRefundsAmount = new Decimal(0);
    
    const agentAdjustments = new Map<string, {
      name: string;
      originalDebited: Decimal;
      correctDebited: Decimal;
      refundDue: Decimal;
    }>();
    
    const logUpdates: {
      logId: string;
      gameId: string | null;
      agentId: string;
      originalAmount: Decimal;
      correctAmount: Decimal;
      originalSales: Decimal | null;
      correctSales: Decimal;
    }[] = [];

    // 2. Loop through each log and compute correct commission
    for (const log of logs) {
      totalOriginalAmount = totalOriginalAmount.add(new Decimal(log.amount.toString()));
      
      let correctSales = new Decimal(0);
      let correctCommission = new Decimal(0);
      
      if (log.gameId) {
        // Fetch all real (non-bot) tickets for this game
        const tickets = await prisma.ticket.findMany({
          where: { gameId: log.gameId },
          include: { user: { select: { isBot: true, referredBy: true } } }
        });
        
        const realTickets = tickets.filter(t => !t.user?.isBot);
        
        if (realTickets.length > 0) {
          // Find game room to get ticket price
          const gameObj = await prisma.game.findUnique({
            where: { id: log.gameId },
            include: { room: { select: { ticketPrice: true } } }
          });
          
          if (gameObj) {
            const ticketPrice = new Decimal(gameObj.room.ticketPrice.toString());
            
            // Filter tickets belonging to this agent
            let agentTicketsCount = 0;
            for (const ticket of realTickets) {
              let ticketAgentId = ticket.user?.referredBy ?? null;
              
              // Verify agent role
              if (ticketAgentId) {
                const agentUser = await prisma.user.findUnique({ where: { id: ticketAgentId }, select: { role: true } });
                if (agentUser?.role !== 'AGENT' && agentUser?.role !== 'ADMIN' && agentUser?.role !== 'admin') {
                  ticketAgentId = null;
                }
              }
              
              // No fallback to default agent
              
              if (ticketAgentId === log.agentId) {
                agentTicketsCount++;
              }
            }
            
            correctSales = ticketPrice.mul(agentTicketsCount);
            correctCommission = correctSales.mul(rate);
          }
        }
      }
      
      totalCorrectedAmount = totalCorrectedAmount.add(correctCommission);
      const refundDue = new Decimal(log.amount.toString()).sub(correctCommission);
      totalRefundsAmount = totalRefundsAmount.add(refundDue);
      
      // Update agent summary
      const existingAdj = agentAdjustments.get(log.agentId) || {
        name: '',
        originalDebited: new Decimal(0),
        correctDebited: new Decimal(0),
        refundDue: new Decimal(0)
      };
      
      if (!existingAdj.name) {
        const agentUser = await prisma.user.findUnique({ where: { id: log.agentId }, select: { firstName: true } });
        existingAdj.name = agentUser?.firstName || `Agent ${log.agentId.slice(0, 8)}`;
      }
      
      existingAdj.originalDebited = existingAdj.originalDebited.add(new Decimal(log.amount.toString()));
      existingAdj.correctDebited = existingAdj.correctDebited.add(correctCommission);
      existingAdj.refundDue = existingAdj.refundDue.add(refundDue);
      agentAdjustments.set(log.agentId, existingAdj);
      
      logUpdates.push({
        logId: log.id,
        gameId: log.gameId,
        agentId: log.agentId,
        originalAmount: new Decimal(log.amount.toString()),
        correctAmount: correctCommission,
        originalSales: log.totalSales ? new Decimal(log.totalSales.toString()) : null,
        correctSales
      });
    }
    
    // 3. Print Summary
    console.log("=== RESYNC AUDIT SUMMARY ===");
    console.log(`Total Commission Logs Scanned: ${logs.length}`);
    console.log(`Total Original Debited:       ${totalOriginalAmount.toFixed(2)} ETB`);
    console.log(`Total Correct Debits:         ${totalCorrectedAmount.toFixed(2)} ETB`);
    console.log(`Total Refund Liquidity:        ${totalRefundsAmount.toFixed(2)} ETB\n`);
    
    console.log("=== REFUNDS PER AGENT ===");
    console.log("--------------------------------------------------------------------------------------------------");
    console.log("AGENT NAME     | ORIGINAL DEBITED      | CORRECT DEBITED       | REFUND AMOUNT");
    console.log("--------------------------------------------------------------------------------------------------");
    for (const [agentId, adj] of agentAdjustments.entries()) {
      console.log(
        `${adj.name.padEnd(14)} | ` +
        `${adj.originalDebited.toFixed(2).padStart(17)} ETB | ` +
        `${adj.correctDebited.toFixed(2).padStart(17)} ETB | ` +
        `\x1b[32m${adj.refundDue.toFixed(2).padStart(13)} ETB\x1b[0m`
      );
    }
    console.log("--------------------------------------------------------------------------------------------------\n");
    
    // 4. Perform database updates if executing
    if (!isDryRun) {
      console.log("Applying database updates inside transaction...");
      
      await prisma.$transaction(async (tx) => {
        // A. Update Commission Logs to match correct values
        for (const update of logUpdates) {
          await tx.agentCommissionLog.update({
            where: { id: update.logId },
            data: {
              amount: update.correctAmount,
              totalSales: update.correctSales,
              description: update.gameId 
                ? `Company commission corrected for game ${update.gameId} (Sales: ${update.correctSales.toFixed(2)} ETB)`
                : `Company commission corrected`
            }
          });
        }
        
        console.log(`✅ Corrected ${logUpdates.length} commission log entries.`);
        
        // B. Credit wallets and update totalDebited
        for (const [agentId, adj] of agentAdjustments.entries()) {
          const wallet = await tx.agentPreDepositWallet.findUnique({ where: { agentId } });
          if (wallet) {
            const beforeBalance = new Decimal(wallet.balance.toString());
            const afterBalance = beforeBalance.add(adj.refundDue);
            
            const beforeDebited = new Decimal(wallet.totalDebited.toString());
            const afterDebited = Decimal.max(0, beforeDebited.sub(adj.refundDue));
            
            await tx.agentPreDepositWallet.update({
              where: { agentId },
              data: {
                balance: afterBalance,
                totalDebited: afterDebited,
                updatedAt: new Date()
              }
            });
            
            console.log(`✅ Refunded ${adj.name}: Balance ${beforeBalance.toFixed(2)} -> ${afterBalance.toFixed(2)} ETB | Debited: ${beforeDebited.toFixed(2)} -> ${afterDebited.toFixed(2)} ETB`);
            
            // Create a correction log entry for each agent
            await tx.agentCommissionLog.create({
              data: {
                agentId,
                walletId: wallet.id,
                type: 'RECHARGE',
                amount: adj.refundDue,
                description: `System correction: Refund of over-debited pre-deposit commissions (referrals bug fix)`,
                balanceBefore: beforeBalance,
                balanceAfter: afterBalance,
              }
            });
          }
        }
      });
      
      console.log("\n=====================================================================");
      console.log("🎉 DATABASE RE-SYNC AND REFUNDS EXECUTED SUCCESSFULLY!");
      console.log("=====================================================================");
    } else {
      console.log("=====================================================================");
      console.log("DRY-RUN COMPLETE. Run with '--execute' flag to apply these changes.");
      console.log("=====================================================================");
    }
    
  } catch (err: any) {
    console.error("\n❌ FATAL ERROR running re-sync script:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
