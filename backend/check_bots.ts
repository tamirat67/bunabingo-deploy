import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:postgres@localhost:5432/bunabingo?schema=public"
    }
  }
});

async function main() {
  const count = await prisma.user.count({ where: { isBot: true } });
  console.log(`There are ${count} bots in the database.`);
  if (count === 0) {
    console.log("No bots found. Checking if there are users that LOOK like bots but don't have isBot=true...");
    const allUsers = await prisma.user.findMany({ take: 10 });
    console.log("Sample users:", allUsers.map(u => ({ id: u.id, name: u.firstName, isBot: u.isBot })));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
