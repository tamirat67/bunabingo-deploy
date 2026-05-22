import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log("=== DB AGENT REPLACEMENT SCRIPT ===");

  // 1. Find the existing Luel user to delete (since it has 0 dependencies)
  const luelUser = await prisma.user.findFirst({
    where: {
      OR: [
        { telegramId: 6836036070n },
        { telegramUsername: { equals: 'Luel1616', mode: 'insensitive' } }
      ]
    }
  });

  if (luelUser) {
    console.log(`Found redundant user ${luelUser.telegramUsername} (${luelUser.telegramId}). Deleting...`);
    
    // Check wallet and delete it if exists
    const luelWallet = await prisma.wallet.findUnique({ where: { userId: luelUser.id } });
    if (luelWallet) {
      await prisma.wallet.delete({ where: { id: luelWallet.id } });
    }
    
    await prisma.user.delete({ where: { id: luelUser.id } });
    console.log("Deleted redundant Luel user successfully!");
  } else {
    console.log("Redundant Luel user not found or already deleted.");
  }

  // 2. Find the Sisay agent user to convert into Luel
  const sisayUser = await prisma.user.findFirst({
    where: {
      OR: [
        { telegramId: 5327151800n },
        { telegramUsername: { equals: 'sisay_2121', mode: 'insensitive' } }
      ]
    }
  });

  if (sisayUser) {
    console.log(`Found Sisay Agent user (${sisayUser.telegramUsername}). Converting to Luel...`);
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const updatedUser = await prisma.user.update({
      where: { id: sisayUser.id },
      data: {
        telegramId: 6836036070n,
        telegramUsername: 'luel1616',
        username: 'luel1616',
        firstName: 'Luel',
        lastName: 'G/libanos',
        passwordHash: hashedPassword,
        role: 'AGENT',
        isAdmin: false
      },
      include: {
        agentPreDepositWallet: true
      }
    });

    console.log("✅ AGENT CONVERTED SUCCESSFULLY!");
    console.log(`ID: ${updatedUser.id}`);
    console.log(`Telegram ID: ${updatedUser.telegramId.toString()}`);
    console.log(`Username: ${updatedUser.username}`);
    console.log(`Telegram Username: ${updatedUser.telegramUsername}`);
    console.log(`First Name: ${updatedUser.firstName}`);
    console.log(`Role: ${updatedUser.role}`);
    console.log(`Pre-Deposit Balance: ${updatedUser.agentPreDepositWallet?.balance.toString()}`);
  } else {
    console.log("❌ ERROR: Sisay Agent user not found in database! Swapping not possible.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
