import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DEMOTING ALL AGENTS EXCEPT @sisay_2121 ---');

  // Demote any AGENT whose telegramUsername is NOT 'sisay_2121' or telegramId is NOT 5327151800n
  const result = await prisma.user.updateMany({
    where: {
      role: { in: ['AGENT', 'agent'] },
      NOT: {
        telegramId: 5327151800n
      }
    },
    data: {
      role: 'PLAYER',
      isAdmin: false
    }
  });

  console.log(`Successfully demoted ${result.count} agents to PLAYER.`);

  // Also search for any specific agent by username if they have a role other than PLAYER
  const extraUsernames = ['bunabingosupport', 'Tekalign09'];
  for (const username of extraUsernames) {
    const updated = await prisma.user.updateMany({
      where: {
        telegramUsername: {
          equals: username,
          mode: 'insensitive'
        },
        NOT: {
          telegramId: 5327151800n
        }
      },
      data: {
        role: 'PLAYER',
        isAdmin: false
      }
    });
    console.log(`Updated username '${username}': ${updated.count} accounts set to PLAYER.`);
  }

  // Let's verify who is left as AGENT
  console.log('\n--- CURRENT AGENTS IN DATABASE ---');
  const currentAgents = await prisma.user.findMany({
    where: { role: { in: ['AGENT', 'agent'] } }
  });
  
  currentAgents.forEach((agent) => {
    console.log(`- ${agent.firstName} (@${agent.telegramUsername}) - ID: ${agent.telegramId} - Role: ${agent.role}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
