const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Checking user database...");
  
  // 1. Find user sisay_2121
  const sisay = await prisma.user.findFirst({
    where: {
      OR: [
        { telegramUsername: 'sisay_2121' },
        { username: 'sisay_2121' }
      ]
    }
  });
  
  if (!sisay) {
    console.log("Error: Could not find user with username/telegramUsername 'sisay_2121'");
  } else {
    console.log("Found sisay_2121:", {
      id: sisay.id,
      firstName: sisay.firstName,
      username: sisay.username,
      telegramUsername: sisay.telegramUsername,
      role: sisay.role,
      isAdmin: sisay.isAdmin
    });
  }

  // 2. Count users by role
  const roleCounts = await prisma.user.groupBy({
    by: ['role'],
    _count: true
  });
  console.log("\nRole counts:", roleCounts);

  // 3. Count referrers
  const referredCounts = await prisma.user.groupBy({
    by: ['referredBy'],
    _count: true
  });
  
  console.log("\nReferral counts:");
  for (const group of referredCounts) {
    if (group.referredBy) {
      const referrer = await prisma.user.findUnique({
        where: { id: group.referredBy },
        select: { firstName: true, telegramUsername: true, username: true, role: true }
      });
      console.log(`Referred by [${group.referredBy}] (${referrer ? referrer.telegramUsername || referrer.username || referrer.firstName : 'unknown'} - role: ${referrer?.role}): ${group._count} users`);
    } else {
      console.log(`No referrer (referredBy = null): ${group._count} users`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
