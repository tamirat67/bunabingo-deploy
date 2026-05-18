import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const usersToSetup = [
    { telegramId: 5310030963n, username: 'tanga_dreams', password: 'admin123', role: 'ADMIN', isAdmin: true },
    { telegramId: 8263717692n, username: 'bunabingosupport', password: 'admin123', role: 'AGENT', isAdmin: false },
    { telegramId: 5327151800n, username: 'sisay_2121', password: 'admin123', role: 'AGENT', isAdmin: false },
  ];

  for (const u of usersToSetup) {
    const hashedPassword = await bcrypt.hash(u.password, 10);
    
    let user = await prisma.user.findUnique({ where: { telegramId: u.telegramId } });
    if (!user) {
      console.log(`User @${u.username} not found. Creating...`);
      user = await prisma.user.create({
        data: {
          telegramId: u.telegramId,
          telegramUsername: u.username,
          role: u.role,
          isAdmin: u.isAdmin,
          passwordHash: hashedPassword,
        }
      });
    } else {
      await prisma.user.update({
        where: { telegramId: u.telegramId },
        data: {
          telegramUsername: u.username,
          role: u.role,
          isAdmin: u.isAdmin,
          passwordHash: hashedPassword,
        }
      });
    }
    console.log(`Successfully set up @${u.username} (${u.role}) with password access.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
