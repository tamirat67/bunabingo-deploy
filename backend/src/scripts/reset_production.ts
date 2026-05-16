import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetForProduction() {
  console.log('🚀 Starting Production Database Reset...');

  try {
    // 1. Delete transactional data (Order is important for foreign keys)
    console.log('🗑️ Clearing games, tickets, and winners...');
    await prisma.winner.deleteMany({});
    await prisma.drawHistory.deleteMany({});
    await prisma.ticket.deleteMany({});
    await prisma.game.deleteMany({});

    console.log('🗑️ Clearing financial history (deposits, withdrawals, commissions)...');
    await prisma.deposit.deleteMany({});
    await prisma.withdrawal.deleteMany({});
    await prisma.agentCommissionLog.deleteMany({});
    await prisma.transaction.deleteMany({});

    // 2. Reset Wallets to 0
    console.log('💰 Resetting all wallet balances to 0 ETB...');
    await prisma.wallet.updateMany({
      data: {
        balance: 0,
        bonusBalance: 0,
        coins: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalWon: 0,
        totalSpent: 0
      }
    });

    // 3. Reset Agent Pre-Deposit Wallets to 0 (Optional: keep or reset)
    console.log('🏦 Resetting Agent Pre-Deposit Wallets...');
    await prisma.agentPreDepositWallet.updateMany({
      data: {
        balance: 0,
        totalRecharged: 0,
        totalDebited: 0
      }
    });

    // 4. Initialize Global Jackpot to 0
    console.log('🎰 Resetting Global Jackpot...');
    await prisma.jackpot.upsert({
      where: { id: 'GLOBAL' },
      update: { currentAmount: 0, targetAmount: 1000 },
      create: { id: 'GLOBAL', currentAmount: 0, targetAmount: 1000 }
    });

    console.log('✅ DATABASE RESET COMPLETE. Your platform is now a clean slate! 🚀');
  } catch (error) {
    console.error('❌ Reset failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetForProduction();
