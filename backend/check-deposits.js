const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const deps = await prisma.deposit.findMany({ select: { id: true, userId: true, status: true } });
  console.log('Deposits:', deps);
}
main().finally(() => prisma.$disconnect());
