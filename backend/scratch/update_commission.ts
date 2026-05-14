import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateCommission() {
  console.log('Updating all wallets to 25% commission rate...');
  
  const result = await prisma.wallet.updateMany({
    data: {
      commissionRate: 0.25
    }
  });

  console.log(`Success! Updated ${result.count} wallets.`);
}

updateCommission()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
