const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function trace() {
  const agentId = '82d99208-b541-44d6-979a-c4caae876916';
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    include: { referrals: { include: { wallet: true } } }
  });

  const realPlayers = agent.referrals.filter(r => !r.isBot);
  const botPlayers = agent.referrals.filter(r => r.isBot);
  const realPlayerIds = realPlayers.map(r => r.id);
  const botPlayerIds = botPlayers.map(r => r.id);
  console.log('Real players:', realPlayerIds.length, ' | Bots:', botPlayerIds.length);

  // All transaction types for real players
  const txTypes = await prisma.transaction.groupBy({
    by: ['type'],
    where: { userId: { in: realPlayerIds } },
    _sum: { amount: true },
    _count: { id: true }
  });
  console.log('\n--- REAL PLAYER TRANSACTION TYPES ---');
  txTypes.forEach(t => console.log(t.type, '| amount:', Number(t._sum.amount || 0).toFixed(2), '| count:', t._count.id));

  // Check if any of the real players got ADMIN top-ups
  const adminTopUps = await prisma.transaction.findMany({
    where: { userId: { in: realPlayerIds }, type: { notIn: ['TICKET_PURCHASE', 'PRIZE_WIN'] } },
    select: { type: true, amount: true, userId: true, createdAt: true }
  });
  console.log('\n--- NON-GAME TRANSACTIONS (top-ups etc) ---');
  adminTopUps.forEach(t => console.log(t.type, ':', Number(t.amount).toFixed(2), 'ETB on', t.createdAt.toISOString().split('T')[0]));

  // Current wallet balances of real players
  console.log('\n--- REAL PLAYER CURRENT BALANCES ---');
  realPlayers.forEach(r => console.log(r.firstName || 'Unknown', ':', Number(r.wallet?.balance || 0).toFixed(2), 'ETB'));

  // Bot transaction types
  const botTxTypes = await prisma.transaction.groupBy({
    by: ['type'],
    where: { userId: { in: botPlayerIds } },
    _sum: { amount: true },
    _count: { id: true }
  });
  console.log('\n--- BOT TRANSACTION TYPES (should NOT appear in commission) ---');
  botTxTypes.forEach(t => console.log(t.type, '| amount:', Number(t._sum.amount || 0).toFixed(2), '| count:', t._count.id));
}
trace().catch(console.error).finally(() => prisma.$disconnect());
