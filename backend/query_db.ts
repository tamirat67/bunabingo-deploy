import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.houseSettings.findFirst();
  console.log("HouseSettings:", settings);
  
  const cycles = await prisma.gameCycle.findMany();
  console.log("GameCycles:", cycles);
}

main().finally(() => prisma.$disconnect());
