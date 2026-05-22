import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log("=== SIMULATING LUEL LOGIN ===");
  const inputUsername = 'luel1616';
  const inputPassword = 'admin123';

  // Extract pure username (remove @)
  let username = inputUsername;
  if (username.startsWith('@')) {
    username = username.substring(1);
  }

  // Find user in DB
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { telegramUsername: username },
        { telegramId: !isNaN(Number(username)) ? BigInt(username) : undefined }
      ]
    }
  });

  if (!user) {
    console.log("❌ USER NOT FOUND IN DB!");
    return;
  }

  console.log("User found:", {
    id: user.id,
    telegramId: user.telegramId.toString(),
    username: user.username,
    telegramUsername: user.telegramUsername,
    firstName: user.firstName,
    role: user.role,
    passwordHashExists: !!user.passwordHash
  });

  if (!user.passwordHash) {
    console.log("❌ NO PASSWORD HASH SET!");
    return;
  }

  const isMatch = await bcrypt.compare(inputPassword, user.passwordHash);
  if (isMatch) {
    console.log("✅ SUCCESS: Password matches!");
  } else {
    console.log("❌ FAILURE: Password does not match!");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
