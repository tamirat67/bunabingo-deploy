import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAdmin() {
  console.log('Promoting @bunabingosupport to Full Admin...');
  
  const user = await prisma.user.findFirst({
    where: { 
      OR: [
        { telegramUsername: 'bunabingosupport' },
        { telegramId: 8263717692n }
      ]
    }
  });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        role: 'ADMIN',
        isAdmin: true
      }
    });
    console.log(`Success! User ${user.username} is now a Full Admin.`);
  } else {
    console.log('User @bunabingosupport not found.');
  }
}

fixAdmin()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
