import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function setPasswords() {
  const staff = ["tanga_dreams", "sisay_2121"];
  const password = "admin123";
  const hashedPassword = await bcrypt.hash(password, 10);

  console.log(`Setting password to '${password}' for staff members...`);

  for (const username of staff) {
    const user = await prisma.user.findFirst({
      where: { telegramUsername: username }
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashedPassword }
      });
      console.log(`✅ Password set for @${username}`);
    } else {
      console.log(`❌ User @${username} not found.`);
    }
  }
}

setPasswords()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
