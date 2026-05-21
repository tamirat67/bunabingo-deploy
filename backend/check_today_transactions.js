const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Let's check both UTC and local days for May 21, 2026 and May 22, 2026
  const dateStr = '2026-05-21';
  let todayStart = new Date(dateStr);
  todayStart.setHours(0,0,0,0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23,59,59,999);

  console.log(`Checking transactions between ${todayStart.toISOString()} and ${todayEnd.toISOString()}`);

  const txs = await prisma.transaction.findMany({
    where: {
      type: 'TICKET_PURCHASE',
      status: { in: ['completed', 'COMPLETED'] },
      createdAt: { gte: todayStart, lte: todayEnd }
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          telegramUsername: true,
          referredBy: true,
          role: true,
          isAdmin: true
        }
      }
    }
  });

  console.log(`\nFound ${txs.length} ticket purchase transactions:`);
  let totalSum = 0;
  for (const tx of txs) {
    const amount = Number(tx.amount);
    totalSum += amount;
    
    let referrerInfo = 'none';
    if (tx.user?.referredBy) {
      const ref = await prisma.user.findUnique({
        where: { id: tx.user.referredBy },
        select: { telegramUsername: true, firstName: true }
      });
      referrerInfo = ref ? `@${ref.telegramUsername || ref.firstName}` : 'unknown';
    }
    
    console.log(`- Tx: ${tx.id} | User: @${tx.user?.telegramUsername || tx.user?.firstName} (Role: ${tx.user?.role}, isAdmin: ${tx.user?.isAdmin}) | Amount: ${amount} ETB | ReferredBy: ${referrerInfo}`);
  }
  console.log(`\nTotal Sum: ${totalSum} ETB`);
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
