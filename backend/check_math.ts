import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const [realSales, realPrizes, deposits, withdrawals] = await Promise.all([
    prisma.transaction.aggregate({ where: { type: 'TICKET_PURCHASE', status: { in: ['completed', 'COMPLETED'] }, user: { isBot: false } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'PRIZE_WIN', status: { in: ['completed', 'COMPLETED'] }, user: { isBot: false } }, _sum: { amount: true } }),
    prisma.deposit.aggregate({ where: { status: { in: ['approved', 'APPROVED', 'completed', 'COMPLETED'] } }, _sum: { amount: true } }),
    prisma.withdrawal.aggregate({ where: { status: { in: ['approved', 'APPROVED', 'completed', 'COMPLETED'] } }, _sum: { amount: true } }),
  ]);

  console.log('--- SYSTEM MATH EXPLANATION ---');
  console.log('Real Player Ticket Sales (Total volume bet):', realSales._sum.amount?.toString(), 'ETB');
  console.log('Real Player Prizes Won (Gross winnings awarded inside the game):', realPrizes._sum.amount?.toString(), 'ETB');
  console.log('RTP (Return to Player):', ((Number(realPrizes._sum.amount) / Number(realSales._sum.amount)) * 100).toFixed(2) + '%');
  console.log('House Edge (Gross Profit for House):', (Number(realSales._sum.amount) - Number(realPrizes._sum.amount)), 'ETB');
  console.log('-------------------------------');
  console.log('Actual Cash In (Deposits):', deposits._sum.amount?.toString(), 'ETB');
  console.log('Actual Cash Out (Withdrawals):', withdrawals._sum.amount?.toString(), 'ETB');
  console.log('Net Cash Flow (Retained by system):', (Number(deposits._sum.amount) - Number(withdrawals._sum.amount)), 'ETB');

  process.exit(0);
}

run();
