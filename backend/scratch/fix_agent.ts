import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupStaff() {
  const staff = [
    { telegramId: 5310030963n, username: "tanga_dreams", firstName: "Admin", role: "ADMIN", isAdmin: true },
    { telegramId: 8263717692n, username: "bunabingosupport", firstName: "Buna Support", role: "AGENT", isAdmin: false },
    { telegramId: 5327151800n, username: "sisay_2121", firstName: "Sisay", role: "AGENT", isAdmin: false }
  ];

  for (const s of staff) {
    console.log(`Processing ${s.role}: @${s.username} (${s.telegramId})...`);

    // 1. Try to find by Telegram ID
    let user = await prisma.user.findUnique({
      where: { telegramId: s.telegramId }
    });

    // 2. If not found by ID, try by Username
    if (!user && s.username) {
        user = await prisma.user.findFirst({
            where: { telegramUsername: s.username }
        });
    }

    if (user) {
      console.log(`User found. Updating to ${s.role}...`);
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          role: s.role, 
          isAdmin: s.isAdmin,
          telegramUsername: s.username,
          telegramId: s.telegramId
        }
      });
      console.log(`Success!`);
    } else {
      console.log(`User not found. Creating new ${s.role} account...`);
      await prisma.user.create({
        data: {
          telegramId: s.telegramId,
          telegramUsername: s.username,
          username: s.username,
          firstName: s.firstName,
          role: s.role,
          isAdmin: s.isAdmin
        }
      });
      console.log(`Success! Created.`);
    }
  }
}

setupStaff()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
