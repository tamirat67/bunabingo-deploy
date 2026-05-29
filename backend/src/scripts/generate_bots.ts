import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BOT_FIRST_NAMES = [
  'Abebe', 'Kebede', 'Almaz', 'Chala', 'Hirut', 'Dawit', 'Sara', 'Bekele', 'Tsion', 'Ephrem',
  'Tadesse', 'Aster', 'Zinash', 'Eyob', 'Mekdes', 'Henok', 'Betty', 'Yosef', 'Kalkidan', 'Biniyam',
  'Alemitu', 'Girma', 'Kidist', 'Samuel', 'Fasika', 'Yonas', 'Marta', 'Tesfaye', 'Selam', 'Abel',
  'Eskinder', 'Hiwot', 'Daniel', 'Lidia', 'Tewodros', 'Mulu', 'Robel', 'Tigist', 'Bereket', 'Hanna',
  'Solomon', 'Meseret', 'Birhanu', 'Eden', 'Aman', 'Genet', 'Habtamu', 'Nardos', 'Natnael', 'Saba'
];

async function main() {
  console.log('🤖 Generating House Bots...');
  
  // Create 50 bots
  for (let i = 0; i < 50; i++) {
    const telegramId = BigInt(1000000 + i);
    const firstName = BOT_FIRST_NAMES[i % BOT_FIRST_NAMES.length];
    const telegramUsername = `bot_${firstName.toLowerCase()}${Math.floor(Math.random() * 1000)}`;
    
    await prisma.user.upsert({
      where: { telegramId },
      update: {},
      create: {
        telegramId,
        firstName,
        telegramUsername,
        isBot: true,
        wallet: {
          create: {
            balance: 0,
            bonusBalance: 0
          }
        }
      }
    });
  }
  
  console.log('✅ Generated 50 House Bots successfully.');
}

main()
  .catch(e => {
    console.error('Failed to generate bots:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
