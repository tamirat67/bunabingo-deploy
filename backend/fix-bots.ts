import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Finding house bots that were mistakenly assigned to agents...');
  
  const botsToFix = await prisma.user.findMany({
    where: {
      isBot: true,
      referredBy: { not: null }
    }
  });

  console.log(`Found ${botsToFix.length} house bots assigned to agents.`);

  if (botsToFix.length > 0) {
    const result = await prisma.user.updateMany({
      where: {
        isBot: true,
        referredBy: { not: null }
      },
      data: {
        referredBy: null
      }
    });
    console.log(`Successfully removed agent assignment from ${result.count} house bots.`);
  } else {
    console.log('No fixes needed.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
