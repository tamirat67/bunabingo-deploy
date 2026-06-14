import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function trace() {
  const agentId = '82d99208-b541-44d6-979a-c4caae876916';
  
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    include: {
      referrals: {
        include: {
          wallet: true
        }
      }
    }
  });

  if (!agent) {
    console.log("Agent not found");
    return;
  }

  const realPlayerIds = agent.referrals.filter(r => !r.isBot).map(r => r.id);
  console.log(`Real players count: ${realPlayerIds.length}`);

  // 1. Total Deposits
  const deposits = await prisma.deposit.aggregate({
    where: { userId: { in: realPlayerIds }, status: { in: ['APPROVED', 'approved'] } },
    _sum: { amount: true }
  });

  // 2. Total Withdrawals
  const withdrawals = await prisma.withdrawal.aggregate({
    where: { userId: { in: realPlayerIds }, status: { in: ['APPROVED', 'COMPLETED', 'approved', 'completed'] } },
    _sum: { amount: true }
  });

  // 3. Admin Balance Additions (Transactions of type 'ADMIN_ADD' or similar?)
  const otherTransactions = await prisma.transaction.groupBy({
    by: ['type'],
    where: { userId: { in: realPlayerIds }, status: { in: ['COMPLETED', 'completed'] } },
    _sum: { amount: true }
  });

  // 4. Current Balances
  const currentBalances = agent.referrals.filter(r => !r.isBot).reduce((sum, r) => sum + Number(r.wallet?.balance || 0), 0);

  console.log('--- AUDIT ---');
  console.log(`Deposits: ${deposits._sum.amount}`);
  console.log(`Withdrawals: ${withdrawals._sum.amount}`);
  console.log(`Current Player Balances: ${currentBalances}`);
  console.log(`Other Transactions:`, otherTransactions.map(t => `${t.type}: ${t._sum.amount}`));

  const adminLogs = await prisma.adminLog.findMany({
    where: { targetUserId: { in: realPlayerIds } }
  });

  console.log('--- ADMIN LOGS ---');
  adminLogs.forEach(l => console.log(`${l.action} -> ${JSON.stringify(l.details)}`));
}

trace().catch(console.error).finally(() => prisma.$disconnect());
