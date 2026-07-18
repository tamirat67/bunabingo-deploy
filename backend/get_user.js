const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const txs = await prisma.transaction.findMany({
    where: { type: 'WEEKLY_BLAST_REWARD' },
    orderBy: { createdAt: 'desc' },
    take: 1
  });

  if (txs.length > 0) {
    const tx = txs[0];
    console.log('Last Blast Tx:', tx);
    
    const wallet = await prisma.wallet.findUnique({
      where: { userId: tx.userId }
    });
    console.log('User Wallet:', wallet);
  } else {
    console.log('No weekly blast tx found');
  }
}

run().then(() => prisma.$disconnect());
