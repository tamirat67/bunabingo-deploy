import { PrismaClient } from '@prisma/client'; 
const prisma = new PrismaClient(); 

async function fix() { 
  await prisma.transaction.updateMany({ 
    where: { type: 'WEEKLY_BLAST_REWARD', amount: 5 }, 
    data: { amount: 500 } 
  }); 

  const txs = await prisma.transaction.findMany({ 
    where: { type: 'WEEKLY_BLAST_REWARD' } 
  }); 

  for (const tx of txs) { 
    await prisma.transaction.update({ 
      where: { id: tx.id }, 
      data: { balanceBefore: Number(tx.balanceAfter) - 500 } 
    }); 
  } 
  
  // also update the participant rewardAmount record if it exists
  await prisma.weeklyRewardParticipant.updateMany({
    where: { isWinner: true, rewardAmount: 5 },
    data: { rewardAmount: 500 }
  });

  console.log('Fixed'); 
} 

fix().then(() => prisma.$disconnect());
