import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.wallet.updateMany({
    where: { balance: { lt: 1000 } },
    data: { balance: 1000 }
  });
  console.log(`Successfully topped up ${result.count} wallets to 1000 ETB!`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
