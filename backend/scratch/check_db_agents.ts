import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== CHECKING AGENT & LUEL USERS ===");
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { telegramUsername: { contains: 'sisay', mode: 'insensitive' } },
        { telegramUsername: { contains: 'luel', mode: 'insensitive' } },
        { username: { contains: 'sisay', mode: 'insensitive' } },
        { username: { contains: 'luel', mode: 'insensitive' } },
        { role: 'AGENT' },
        { telegramId: 6836036070n }
      ]
    },
    include: {
      wallet: true,
      agentPreDepositWallet: true
    }
  });

  for (const u of users) {
    console.log(`ID: ${u.id}`);
    console.log(`Telegram ID: ${u.telegramId.toString()}`);
    console.log(`Username: ${u.username}`);
    console.log(`Telegram Username: ${u.telegramUsername}`);
    console.log(`First Name: ${u.firstName}`);
    console.log(`Role: ${u.role}`);
    console.log(`Is Admin: ${u.isAdmin}`);
    console.log(`Password Hash Set: ${!!u.passwordHash}`);
    console.log(`Wallet Balance: ${u.wallet?.balance}`);
    console.log(`Pre-Deposit Wallet: ${u.agentPreDepositWallet ? u.agentPreDepositWallet.balance.toString() : 'None'}`);
    console.log("-----------------------------------");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
