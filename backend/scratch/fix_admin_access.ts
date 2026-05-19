import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAdmin() {
  console.log('Promoting @tanga_dreams to Full Admin...');
  
  const user = await prisma.user.findFirst({
    where: { 
      OR: [
        { telegramUsername: 'tanga_dreams' },
        { telegramId: 5310030963n }
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
    console.log('User @tanga_dreams not found.');
  }
}

fixAdmin()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
