const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const usersWithAgents = await prisma.user.findMany({
    where: { referredBy: { not: null } }
  });
  console.log('Users with agents:', usersWithAgents.length);
  
  if (usersWithAgents.length > 0) {
    const agentId = usersWithAgents[0].referredBy;
    console.log('Testing with agentId:', agentId);
    
    const pendingDeps = await prisma.deposit.aggregate({
      where: { status: { in: ['pending', 'PENDING'] }, user: { referredBy: agentId } },
      _sum: { amount: true },
      _count: { id: true }
    });
    console.log('Agent Pending Deps:', pendingDeps);
  }
}
check().finally(() => process.exit(0));
