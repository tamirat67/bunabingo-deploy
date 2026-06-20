import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Find the master agent @Luel1616
    const masterAgent = await prisma.user.findFirst({
      where: {
        OR: [
          { telegramUsername: { equals: 'Luel1616', mode: 'insensitive' } },
          { username: { equals: 'Luel1616', mode: 'insensitive' } },
          { firstName: { equals: 'Luel1616', mode: 'insensitive' } }
        ]
      }
    });

    if (!masterAgent) {
      console.log("Could not find master agent Luel1616.");
      return;
    }

    console.log(`Found Master Agent: ${masterAgent.id} - ${masterAgent.telegramUsername || masterAgent.username || masterAgent.firstName} (Role: ${masterAgent.role})`);

    // Assign all unassigned players to this agent
    const result = await prisma.user.updateMany({
      where: {
        referredBy: null,
        isBot: false, // Ensure we don't assign bots
        id: { not: masterAgent.id } // Don't assign the agent to themselves
      },
      data: {
        referredBy: masterAgent.id
      }
    });

    console.log(`Successfully assigned ${result.count} unassigned users to master agent Luel1616.`);
  } catch (error) {
    console.error("Error running assignment:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
