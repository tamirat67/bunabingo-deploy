const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedTransactions() {
  console.log('Seeding transaction records for agents...');
  const agent = await prisma.user.findFirst({ where: { role: 'AGENT' } });
  if (!agent) { console.log('No agent found.'); return; }
  
  const players = await prisma.user.findMany({ where: { referredBy: agent.id } });
  
  for (const player of players) {
    try {
      const hasTx = await prisma.transaction.findFirst({ where: { userId: player.id, type: 'DEPOSIT' } });
      if (!hasTx) {
        await prisma.transaction.create({
          data: {
            userId: player.id,
            type: 'DEPOSIT',
            amount: 100,
            balanceBefore: 0,
            balanceAfter: 100,
            status: 'COMPLETED',
            description: 'REAL_DEP_APP_' + Math.floor(Math.random() * 100000),
          }
        });
        console.log(`Created deposit transaction for ${player.firstName}`);
        
        await prisma.transaction.create({
          data: {
            userId: player.id,
            type: 'WITHDRAWAL',
            amount: 50,
            balanceBefore: 100,
            balanceAfter: 50,
            status: 'COMPLETED',
            description: 'Telebirr Withdrawal',
          }
        });
        console.log(`Created withdrawal transaction for ${player.firstName}`);
      }
    } catch(err) {
      console.log('Error processing player', player.firstName, err.message);
    }
  }
}
seedTransactions().finally(() => process.exit(0));
