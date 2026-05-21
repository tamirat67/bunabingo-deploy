const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const agent = await prisma.user.findFirst({ where: { role: 'AGENT' }, select: { id: true, username: true } });
  if (!agent) return console.log('no agent');
  console.log('Agent:', agent.username);
  const txns = await prisma.transaction.findMany({ where: { user: { referredBy: agent.id } }, select: { id: true } });
  console.log('Txns count:', txns.length);
}
main().finally(() => prisma.$disconnect());
