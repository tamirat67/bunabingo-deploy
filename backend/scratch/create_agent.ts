
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const telegramId = BigInt('5327151800');
  const username = 'sisay_2121';
  
  const user = await prisma.user.findUnique({
    where: { telegram_id: telegramId },
  });

  if (user) {
    console.log('User found, updating to AGENT role...');
    const updatedUser = await prisma.user.update({
      where: { telegram_id: telegramId },
      data: { 
        role: 'agent',
        username: username,
      },
    });
    console.log('User promoted to AGENT:', JSON.stringify(updatedUser, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
  } else {
    console.log('User not found, creating new AGENT account...');
    const newUser = await prisma.user.create({
      data: {
        telegram_id: telegramId,
        username: username,
        role: 'agent',
        referral_code: 'SISAY2121', // Generating a referral code
        wallets: {
          create: {
            balance: 0,
            commission_rate: 0.20,
          }
        }
      },
    });
    console.log('New AGENT account created:', JSON.stringify(newUser, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
