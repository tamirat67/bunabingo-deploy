const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const agent = await prisma.user.findFirst({ where: { username: 'sisay_2121' } });
  console.log('Agent:', agent.id);
  const players = await prisma.user.findMany({ where: { referredBy: agent.id } });
  console.log('Players:', players.map(p => p.id));
  const deps = await prisma.deposit.findMany({ where: { userId: { in: players.map(p => p.id) } } });
  console.log('Deps for players:', deps);
}
check().finally(() => process.exit(0));
