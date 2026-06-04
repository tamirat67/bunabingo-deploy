import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting full data wipe (keeping Users, Wallets, and System Settings intact)...');

  // 1. Delete Game related history
  console.log('Deleting DrawHistory...');
  await prisma.drawHistory.deleteMany();
  
  console.log('Deleting Winners...');
  await prisma.winner.deleteMany();
  
  console.log('Deleting Tickets...');
  await prisma.ticket.deleteMany();
  
  console.log('Deleting Games...');
  await prisma.game.deleteMany();

  console.log('Deleting GameCycles...');
  await prisma.gameCycle.deleteMany();

  // 2. Delete Transaction history
  console.log('Deleting Transactions...');
  await prisma.transaction.deleteMany();
  
  console.log('Deleting Deposits...');
  await prisma.deposit.deleteMany();
  
  console.log('Deleting Withdrawals...');
  await prisma.withdrawal.deleteMany();

  // 3. Delete Logs
  console.log('Deleting AgentCommissionLogs...');
  await prisma.agentCommissionLog.deleteMany();

  console.log('Deleting AdminLogs...');
  await prisma.adminLog.deleteMany();

  // 4. Reset AgentPreDepositWallets (totalRecharged = balance, totalDebited = 0)
  console.log('Resetting AgentPreDepositWallet totals (keeping balances intact)...');
  const preDeposits = await prisma.agentPreDepositWallet.findMany();
  for (const w of preDeposits) {
    await prisma.agentPreDepositWallet.update({
      where: { id: w.id },
      data: {
        totalRecharged: w.balance, // Start the audit baseline from the current actual balance
        totalDebited: 0
      }
    });
  }

  // 5. Reset SystemWallet to 0
  console.log('Resetting System Wallet...');
  await prisma.systemWallet.updateMany({
    data: { balance: 0 }
  });

  // 6. Reset Jackpot to starting point
  console.log('Resetting Jackpot...');
  await prisma.jackpot.updateMany({
    data: { currentAmount: 0 }
  });

  console.log('✅ All transactions, logs, and game histories have been cleared.');
  console.log('✅ User wallets and Agent Pre-Deposit balances were entirely preserved.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
