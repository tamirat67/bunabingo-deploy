const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.deposit.aggregate({
    where: { status: 'pending', user: {} },
    _count: { id: true }
  });
  console.log('Count with {}:', count);
  
  const countUndefined = await prisma.deposit.aggregate({
    where: { status: 'pending', user: undefined },
    _count: { id: true }
  });
  console.log('Count with undefined:', countUndefined);
}
main().finally(() => prisma.$disconnect());
