const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("==================================================");
  console.log("ASSIGNING ALL PLATFORM PLAYERS TO AGENT @sisay_2121");
  console.log("==================================================");

  // 1. Find user luel1616 (or sisay_2121 fallback)
  const agent = await prisma.user.findFirst({
    where: {
      OR: [
        { telegramUsername: { equals: 'luel1616', mode: 'insensitive' } },
        { username: { equals: 'luel1616', mode: 'insensitive' } },
        { telegramUsername: { equals: 'sisay_2121', mode: 'insensitive' } },
        { username: { equals: 'sisay_2121', mode: 'insensitive' } }
      ]
    }
  });

  if (!agent) {
    console.error("❌ ERROR: Could not find user with username or telegramUsername 'luel1616' or 'sisay_2121' in the database!");
    console.error("Please make sure the agent is registered via the bot or admin panel first.");
    return;
  }

  console.log(`\nFound agent: ${agent.firstName || 'Sisay'} (@${agent.telegramUsername || agent.username})`);
  console.log(`Agent ID: ${agent.id}`);
  console.log(`Current Role: ${agent.role} (isAdmin: ${agent.isAdmin})`);

  // Ensure role is AGENT (if they aren't already an admin)
  if (agent.role !== 'AGENT' && agent.role !== 'ADMIN') {
    console.log(`Updating role of @sisay_2121 to AGENT...`);
    await prisma.user.update({
      where: { id: agent.id },
      data: { role: 'AGENT' }
    });
    console.log(`Role updated to AGENT.`);
  }

  // 2. Count before state
  const totalPlayers = await prisma.user.count({
    where: {
      id: { not: agent.id },
      role: { notIn: ['ADMIN'] },
      isAdmin: false
    }
  });

  const alreadyAssigned = await prisma.user.count({
    where: {
      referredBy: agent.id,
      id: { not: agent.id },
      role: { notIn: ['ADMIN'] },
      isAdmin: false
    }
  });

  const assignedToOthers = await prisma.user.count({
    where: {
      referredBy: { not: agent.id },
      NOT: {
        referredBy: null
      },
      id: { not: agent.id },
      role: { notIn: ['ADMIN'] },
      isAdmin: false
    }
  });

  const unassigned = await prisma.user.count({
    where: {
      referredBy: null,
      id: { not: agent.id },
      role: { notIn: ['ADMIN'] },
      isAdmin: false
    }
  });

  console.log(`\nCurrent user statistics (excluding agent @sisay_2121 and Admins):`);
  console.log(`- Total Players to assign: ${totalPlayers}`);
  console.log(`  * Already assigned to @sisay_2121: ${alreadyAssigned}`);
  console.log(`  * Assigned to other agents:       ${assignedToOthers}`);
  console.log(`  * Unassigned (no agent):          ${unassigned}`);

  if (totalPlayers === alreadyAssigned) {
    console.log(`\n✅ All players are already assigned to @sisay_2121! No changes needed.`);
    return;
  }

  // 3. Update all players to be referred by sisay_2121
  console.log(`\nUpdating all non-admin players to be referred by @sisay_2121...`);
  const result = await prisma.user.updateMany({
    where: {
      id: { not: agent.id },
      role: { notIn: ['ADMIN'] },
      isAdmin: false
    },
    data: {
      referredBy: agent.id
    }
  });

  console.log(`✅ Successfully updated ${result.count} users!`);

  // 4. Verify post state
  const postAlreadyAssigned = await prisma.user.count({
    where: {
      referredBy: agent.id,
      id: { not: agent.id },
      role: { notIn: ['ADMIN'] },
      isAdmin: false
    }
  });

  const postAssignedToOthers = await prisma.user.count({
    where: {
      referredBy: { not: agent.id },
      NOT: {
        referredBy: null
      },
      id: { not: agent.id },
      role: { notIn: ['ADMIN'] },
      isAdmin: false
    }
  });

  const postUnassigned = await prisma.user.count({
    where: {
      referredBy: null,
      id: { not: agent.id },
      role: { notIn: ['ADMIN'] },
      isAdmin: false
    }
  });

  console.log(`\nVerification post-update:`);
  console.log(`- Assigned to @sisay_2121: ${postAlreadyAssigned}`);
  console.log(`- Assigned to other agents:       ${postAssignedToOthers}`);
  console.log(`- Unassigned (no agent):          ${postUnassigned}`);

  console.log("\n==================================================");
  console.log("✅ ALL ASSIGNMENTS COMPLETED SUCCESSFULLY");
  console.log("==================================================");
}

main()
  .catch(err => {
    console.error("❌ Fatal error during migration:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
