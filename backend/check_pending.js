const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const pendingDeps = await prisma.deposit.findMany({
    where: { status: { in: ['pending', 'PENDING'] } },
    include: { user: true }
  });
  console.log('Pending Deps Users:', pendingDeps.map(d => d.user.referredBy));
}
check().finally(() => process.exit(0));
