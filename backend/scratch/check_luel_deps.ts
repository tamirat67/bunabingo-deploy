import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const luelId = '55ac5161-6284-493e-b49b-f9f155e587dd';
  console.log("=== CHECKING LUEL DEPENDENCIES ===");
  const tickets = await prisma.ticket.count({ where: { userId: luelId } });
  const deposits = await prisma.deposit.count({ where: { userId: luelId } });
  const withdrawals = await prisma.withdrawal.count({ where: { userId: luelId } });
  const transactions = await prisma.transaction.count({ where: { userId: luelId } });
  const referrals = await prisma.user.count({ where: { referredBy: luelId } });

  console.log(`Tickets: ${tickets}`);
  console.log(`Deposits: ${deposits}`);
  console.log(`Withdrawals: ${withdrawals}`);
  console.log(`Transactions: ${transactions}`);
  console.log(`Referrals: ${referrals}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
