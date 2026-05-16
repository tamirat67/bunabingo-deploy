const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetForProduction() {
  console.log('🚀 Starting Production Database Reset...');

  try {
    console.log('🗑️ Clearing games, tickets, and winners...');
    await prisma.winner.deleteMany({});
    await prisma.drawHistory.deleteMany({});
    await prisma.ticket.deleteMany({});
    await prisma.game.deleteMany({});

    console.log('🗑️ Clearing financial history...');
    await prisma.deposit.deleteMany({});
    await prisma.withdrawal.deleteMany({});
    await prisma.agentCommissionLog.deleteMany({});
    await prisma.transaction.deleteMany({});

    console.log('💰 Resetting wallet balances...');
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

    console.log('🏦 Resetting Agent wallets...');
    await prisma.agentPreDepositWallet.updateMany({
      data: {
        balance: 0,
        totalRecharged: 0,
        totalDebited: 0
      }
    });

    console.log('🎰 Resetting Jackpot...');
    await prisma.jackpot.upsert({
      where: { id: 'GLOBAL' },
      update: { currentAmount: 0, targetAmount: 1000 },
      create: { id: 'GLOBAL', currentAmount: 0, targetAmount: 1000 }
    });

    console.log('✅ DATABASE RESET COMPLETE. 🚀');
  } catch (error) {
    console.error('❌ Reset failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetForProduction();
