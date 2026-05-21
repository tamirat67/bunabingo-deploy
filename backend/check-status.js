const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const deps = await prisma.deposit.groupBy({ by: ['status'], _count: true });
  console.log('Deposits:', deps);
  const wds = await prisma.withdrawal.groupBy({ by: ['status'], _count: true });
  console.log('Withdrawals:', wds);
  const txs = await prisma.transaction.groupBy({ by: ['status'], _count: true });
  console.log('Transactions:', txs);
}
main().finally(() => prisma.$disconnect());
