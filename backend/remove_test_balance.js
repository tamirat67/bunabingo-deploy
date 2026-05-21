const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function removeTestBalance() {
  console.log('Starting to remove 1000 ETB test balance from all wallets...');
  
  const wallets = await prisma.wallet.findMany();
  let updatedCount = 0;
  
  for (const wallet of wallets) {
    const currentBalance = Number(wallet.balance);
    if (currentBalance > 0) {
      // Calculate the new balance by subtracting 1000, bounding at 0
      const newBalance = Math.max(0, currentBalance - 1000);
      
      if (newBalance !== currentBalance) {
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: newBalance }
        });
        updatedCount++;
        console.log(`Updated wallet for user ${wallet.userId}: ${currentBalance} -> ${newBalance}`);
      }
    }
  }
  
  console.log(`Finished removing test balances. Updated ${updatedCount} wallets.`);
}

removeTestBalance()
  .catch(e => console.error(e))
  .finally(() => process.exit(0));
