const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('Deposits:', await prisma.deposit.count());
  console.log('Withdrawals:', await prisma.withdrawal.count());
  console.log('Transactions:', await prisma.transaction.count());
  console.log('Pending Deposits:', await prisma.deposit.count({ where: { status: 'PENDING' } }));
}
main().then(() => process.exit(0));
