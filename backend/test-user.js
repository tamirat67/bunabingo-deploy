process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/bunabingo?schema=public";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { telegramId: 5327151800n },
        { phone: { contains: '251929922421' } }
      ]
    },
    include: { wallet: true }
  });
  
  console.log("Users found:");
  console.log(users.map(u => ({ id: u.id, name: u.firstName, tgId: u.telegramId.toString(), phone: u.phone, bal: u.wallet.balance })));
}

run().finally(() => prisma.$disconnect());
