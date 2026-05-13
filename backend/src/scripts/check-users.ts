import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const usernames = ['tanga_dreams', 'bunabingosupport', 'sisay_2121'];
  const users = await prisma.user.findMany({
    where: {
      telegramUsername: { in: usernames }
    }
  });

  console.log('--- Current Users in DB ---');
  users.forEach(u => {
    console.log(`Username: ${u.telegramUsername}`);
    console.log(`ID: ${u.telegramId.toString()}`);
    console.log(`Role: ${u.role}`);
    console.log(`isAdmin: ${u.isAdmin}`);
    console.log(`Has Password: ${!!u.passwordHash}`);
    console.log('---------------------------');
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
