import { PrismaClient } from '@prisma/client'; 
const prisma = new PrismaClient(); 
async function main() { 
  await prisma.game.updateMany({ 
    where: { status: 'WAITING' }, 
    data: { status: 'COUNTDOWN', countdownSeconds: 20 } 
  }); 
  console.log('Fixed stuck games'); 
} 
main();
