const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const userFilter = {}; // simulating admin
  
  const pendingDeps = await prisma.deposit.aggregate({
    where: { status: { in: ['pending', 'PENDING'] }, user: userFilter },
    _sum: { amount: true },
    _count: { id: true }
  });
  const approvedDepsAgg = await prisma.deposit.aggregate({
    where: { status: { in: ['approved', 'completed', 'APPROVED', 'COMPLETED'] }, user: userFilter },
    _sum: { amount: true }
  });
  
  console.log('Pending Deps:', pendingDeps);
  console.log('Approved Deps:', approvedDepsAgg);
}
check().finally(() => process.exit(0));
