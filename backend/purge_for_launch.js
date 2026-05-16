const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function purgeAllData() {
  console.log('🚀 Starting Full Production Cleanse...');

  try {
    // 1. Delete Activity Data (Order matters for foreign keys)
    console.log('- Clearing Winners...');
    await prisma.winner.deleteMany({});

    console.log('- Clearing Tickets...');
    await prisma.ticket.deleteMany({});

    console.log('- Clearing Draw History...');
    await prisma.drawHistory.deleteMany({});

    console.log('- Clearing Games...');
    await prisma.game.deleteMany({});

    console.log('- Clearing Transactions...');
    await prisma.transaction.deleteMany({});

    console.log('- Clearing Deposits...');
    await prisma.deposit.deleteMany({});

    console.log('- Clearing Withdrawals...');
    await prisma.withdrawal.deleteMany({});

    console.log('- Clearing Admin Logs...');
    await prisma.adminLog.deleteMany({});

    console.log('- Clearing Agent Commission Logs...');
    await prisma.agentCommissionLog.deleteMany({});

    // 2. Reset Wallets
    console.log('- Resetting all Wallets to 0...');
    await prisma.wallet.updateMany({
      data: {
        balance: 0,
        bonusBalance: 0,
        referralBalance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalWon: 0,
        totalSpent: 0,
        coins: 0
      }
    });

    // 3. Reset Agent Pre-Deposit Wallets (Initial seed = 10,000)
    console.log('- Resetting Agent Pre-Deposit Wallets to seed (10,000 ETB)...');
    await prisma.agentPreDepositWallet.updateMany({
      data: {
        balance: 10000,
        totalDebited: 0,
        totalRecharged: 0
      }
    });

    console.log('\n✅ DATABASE CLEANSED SUCCESSFULLY. Ready for Production Launch!');
  } catch (error) {
    console.error('❌ Cleanse failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

purgeAllData();
