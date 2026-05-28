const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { telegramId: 7374663118n }
  });
  console.log("USER:", user);
  
  if (user && user.referredBy) {
    const referrer = await prisma.user.findUnique({
      where: { id: user.referredBy }
    });
    console.log("REFERRER:", referrer);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
