
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userId = 'e8a2ebe6-6843-45f5-8892-fff72058bff6';
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(JSON.stringify(transactions, null, 2));
  
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  console.log('Wallet:', JSON.stringify(wallet, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
