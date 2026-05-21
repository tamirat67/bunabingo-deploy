const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding real data for testing...');
  const agent = await prisma.user.findFirst({ where: { role: 'AGENT' } });
  if (!agent) { console.log('No agent found.'); return; }
  
  const players = await prisma.user.findMany({ where: { role: 'PLAYER' }, take: 3 });
  
  for (const player of players) {
    try {
      await prisma.user.update({ where: { id: player.id }, data: { referredBy: agent.id } });
      
      const hasPendingDep = await prisma.deposit.findFirst({ where: { userId: player.id, status: 'PENDING' } });
      if (!hasPendingDep) {
        await prisma.deposit.create({
          data: {
            userId: player.id,
            amount: 50,
            txnId: 'REAL_DEP_' + Math.floor(Math.random() * 100000), // txnId is required, not reference
            status: 'PENDING',
          }
        });
        console.log(`Created pending deposit for ${player.firstName}`);
      }
      
      const hasPendingWd = await prisma.withdrawal.findFirst({ where: { userId: player.id, status: 'PENDING' } });
      if (!hasPendingWd) {
        await prisma.withdrawal.create({
          data: {
            userId: player.id,
            amount: 20,
            bankName: 'CBE',
            accountNumber: '1000' + Math.floor(Math.random() * 100000),
            accountName: player.firstName + ' REAL',
            status: 'PENDING'
          }
        });
        console.log(`Created pending withdrawal for ${player.firstName}`);
      }
      
      const hasApprovedDep = await prisma.deposit.findFirst({ where: { userId: player.id, status: 'APPROVED' } });
      if (!hasApprovedDep) {
         await prisma.deposit.create({
          data: {
            userId: player.id,
            amount: 100,
            txnId: 'REAL_DEP_APP_' + Math.floor(Math.random() * 100000),
            status: 'APPROVED',
          }
        });
        console.log(`Created approved deposit for ${player.firstName}`);
      }
      
      const hasCompletedWd = await prisma.withdrawal.findFirst({ where: { userId: player.id, status: 'COMPLETED' } });
      if (!hasCompletedWd) {
         await prisma.withdrawal.create({
          data: {
            userId: player.id,
            amount: 50,
            bankName: 'Telebirr',
            accountNumber: '0911' + Math.floor(Math.random() * 10000),
            accountName: player.firstName + ' REAL',
            status: 'COMPLETED'
          }
        });
        console.log(`Created completed withdrawal for ${player.firstName}`);
      }
    } catch(err) {
      console.log('Error processing player', player.firstName, err.message);
    }
  }
}
seed().finally(() => process.exit(0));
