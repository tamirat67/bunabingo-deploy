import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { promoteToAgent } from '../services/user.service';

const prisma = new PrismaClient();

async function addAgent(telegramUsername: string, telegramId: bigint, passwordPlain: string) {
  if (telegramUsername.startsWith('@')) telegramUsername = telegramUsername.substring(1);

  console.log(`Processing Agent: ${telegramUsername} (${telegramId})`);

  let user = await prisma.user.findUnique({ where: { telegramId } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId,
        telegramUsername,
        firstName: telegramUsername,
        role: 'USER',
        status: 'ACTIVE'
      }
    });
    console.log(`  - Created user profile`);
  }

  // Promote to AGENT and seed wallet
  // Using a valid UUID for adminId (using the user's own ID as a placeholder for the log)
  await promoteToAgent(user.id, user.id);
  console.log(`  - Promoted to AGENT & Wallet seeded`);

  // Set Password
  const hash = await bcrypt.hash(passwordPlain, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { 
      passwordHash: hash,
      telegramUsername // Ensure username is correct
    }
  });
  console.log(`  - Password set to: ${passwordPlain}`);
}

async function main() {
  await addAgent('Luel1616', 6836036070n, 'admin123');
  console.log('\nAll agents added successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
