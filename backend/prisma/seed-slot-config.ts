import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Buna Hot 5 slot config...');

  // Target RTP: ~95.5%
  const paytable = {
    CHERRY: 5,
    LEMON: 5,
    ORANGE: 10,
    PLUM: 10,
    WATERMELON: 15,
    GRAPES: 15,
    BELL: 25,
    BAR: 50,
    SEVEN: 100
  };

  const symbolWeights = {
    CHERRY: 25,
    LEMON: 25,
    ORANGE: 18,
    PLUM: 18,
    WATERMELON: 10,
    GRAPES: 10,
    BELL: 6,
    BAR: 3,
    SEVEN: 1
  };

  const multiplierWeights = {
    "1": 50,
    "2": 25,
    "3": 12,
    "5": 8,
    "10": 4,
    "15": 1
  };

  await prisma.slotGameConfig.upsert({
    where: { gameKey: 'buna_hot_5' },
    update: {
      minBet: 5,
      maxBet: 2000,
      betStep: 5,
      paytable,
      symbolWeights,
      multiplierWeights,
      gambleMaxRounds: 3,
      targetRtp: 0.955,
      isActive: true,
    },
    create: {
      gameKey: 'buna_hot_5',
      minBet: 5,
      maxBet: 2000,
      betStep: 5,
      paytable,
      symbolWeights,
      multiplierWeights,
      gambleMaxRounds: 3,
      targetRtp: 0.955,
      isActive: true,
    }
  });

  console.log('✅ Buna Hot 5 config seeded successfully');
}

main()
  .catch(e => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
