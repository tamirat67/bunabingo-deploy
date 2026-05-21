const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("==================================================");
  console.log("ASSIGNING EVERY USER (INCLUDING ADMINS) TO @sisay_2121");
  console.log("==================================================");

  // 1. Find user sisay_2121
  const agent = await prisma.user.findFirst({
    where: {
      OR: [
        { telegramUsername: { equals: 'sisay_2121', mode: 'insensitive' } },
        { username: { equals: 'sisay_2121', mode: 'insensitive' } }
      ]
    }
  });

  if (!agent) {
    console.error("❌ ERROR: Could not find user with username or telegramUsername 'sisay_2121' in the database!");
    return;
  }

  console.log(`\nFound agent: ${agent.firstName || 'Sisay'} (@${agent.telegramUsername || agent.username})`);
  console.log(`Agent ID: ${agent.id}`);

  // Count how many users exist total (except sisay_2121 themselves)
  const totalOthersCount = await prisma.user.count({
    where: {
      id: { not: agent.id }
    }
  });

  const alreadyAssignedCount = await prisma.user.count({
    where: {
      id: { not: agent.id },
      referredBy: agent.id
    }
  });

  const unassignedCount = totalOthersCount - alreadyAssignedCount;

  console.log(`\nBefore Update:`);
  console.log(`- Total other users in database: ${totalOthersCount}`);
  console.log(`- Already referred by @sisay_2121: ${alreadyAssignedCount}`);
  console.log(`- To be updated (admins, support, etc.): ${unassignedCount}`);

  if (unassignedCount === 0) {
    console.log(`\n✅ All other users are already referred by @sisay_2121!`);
    return;
  }

  // Update EVERY user except sisay_2121 to be referred by sisay_2121
  console.log(`\nUpdating all ${unassignedCount} other users to have referredBy = '${agent.id}'...`);
  const result = await prisma.user.updateMany({
    where: {
      id: { not: agent.id }
    },
    data: {
      referredBy: agent.id
    }
  });

  console.log(`\n✅ Successfully updated ${result.count} users in the database!`);

  // Verify final count
  const postAssignedCount = await prisma.user.count({
    where: {
      id: { not: agent.id },
      referredBy: agent.id
    }
  });

  console.log(`\nAfter Update Verification:`);
  console.log(`- Total other users: ${totalOthersCount}`);
  console.log(`- Referred by @sisay_2121: ${postAssignedCount}`);
  console.log(`- Remaining unassigned: ${totalOthersCount - postAssignedCount}`);

  console.log("\n==================================================");
  console.log("✅ PLATFORM-WIDE REFERRAL MIGRATION COMPLETE!");
  console.log("==================================================");
}

main()
  .catch(err => {
    console.error("❌ Fatal error:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
