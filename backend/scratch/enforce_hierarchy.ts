import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function enforceHierarchy() {
  console.log('Enforcing Official Role Hierarchy...');

  // 1. Set the Full Admin
  await prisma.user.updateMany({
    where: { 
      OR: [
        { telegramUsername: 'tanga_dreams' },
        { telegramId: 5310030963n }
      ]
    },
    data: { role: 'ADMIN', isAdmin: true }
  });
  console.log('✅ @tanga_dreams is now Full ADMIN.');

  // 2. Set the Agents
  const agents = ['bunabingosupport', 'sisay_2121'];
  for (const username of agents) {
    await prisma.user.updateMany({
      where: { telegramUsername: username },
      data: { role: 'AGENT', isAdmin: false }
    });
    console.log(`✅ @${username} is now AGENT.`);
  }

  console.log('Hierarchy enforcement complete!');
}

enforceHierarchy()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
