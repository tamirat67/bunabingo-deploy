import prisma from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

async function main() {
  console.log("==========================================================");
  console.log("=== AGENT PRE-DEPOSIT WALLET RE-CALCULATION & CLEANUP ===");
  console.log("==========================================================\n");

  try {
    await prisma.$connect();

    // 1. Fetch all agent pre-deposit wallets
    const wallets = await prisma.agentPreDepositWallet.findMany({
      include: {
        agent: {
          select: {
            firstName: true,
            telegramUsername: true,
          }
        }
      }
    });

    console.log(`Found ${wallets.length} agent wallet(s) in database.\n`);

    await prisma.$transaction(async (tx) => {
      for (const wallet of wallets) {
        const agentName = wallet.agent?.firstName || wallet.agent?.telegramUsername || wallet.agentId;
        
        let totalRecharged = new Decimal(wallet.totalRecharged.toString());
        const totalDebited = new Decimal(wallet.totalDebited.toString());
        const oldBalance = new Decimal(wallet.balance.toString());

        // Self-healing: If it is the default agent or was seeded with 10k balance but totalRecharged is 0
        if (totalRecharged.isZero() && oldBalance.equals(10000)) {
          console.log(`[Self-Healing] Agent ${agentName}: totalRecharged is 0 but balance was seeded at 10,000 ETB. Setting totalRecharged to 10,000.`);
          totalRecharged = new Decimal(10000);
        }

        // Strict Formula: balance = totalRecharged - totalDebited
        const newBalance = totalRecharged.sub(totalDebited);

        if (!oldBalance.equals(newBalance) || !totalRecharged.equals(wallet.totalRecharged.toString())) {
          await tx.agentPreDepositWallet.update({
            where: { id: wallet.id },
            data: {
              balance: newBalance,
              totalRecharged: totalRecharged,
              updatedAt: new Date(),
            }
          });

          console.log(`✅ Corrected Agent: ${agentName}`);
          console.log(`   - Stake (Total Recharged): ${totalRecharged.toFixed(2)} ETB`);
          console.log(`   - Total Debited (Commissions): ${totalDebited.toFixed(2)} ETB`);
          console.log(`   - Balance: ${oldBalance.toFixed(2)} ETB ──> ${newBalance.toFixed(2)} ETB (going down strictly as intended)`);
          
          // Log a system adjustment entry to the commission logs
          await tx.agentCommissionLog.create({
            data: {
              agentId: wallet.agentId,
              walletId: wallet.id,
              type: 'COMMISSION_DEBIT', // or system correction
              amount: oldBalance.sub(newBalance),
              description: `System cleanup: Adjusted balance from ${oldBalance.toFixed(2)} to ${newBalance.toFixed(2)} ETB to remove non-recharge incremental credits (e.g. withdrawal reimbursements)`,
              balanceBefore: oldBalance,
              balanceAfter: newBalance,
            }
          });
        } else {
          console.log(`ℹ️ Agent ${agentName} wallet is already correct. Balance: ${oldBalance.toFixed(2)} ETB.`);
        }
      }
    });

    console.log("\n==========================================================");
    console.log("🎉 DATABASE BALANCES CORRECTED SUCCESSFULLY!");
    console.log("==========================================================");

  } catch (err: any) {
    console.error("\n❌ FATAL ERROR running correction script:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
