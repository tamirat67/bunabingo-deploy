const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [
    pendingDeps,
    pendingWds,
    approvedDepsAgg,
    completedWdsAgg
  ] = await Promise.all([
    prisma.deposit.aggregate({
      where: { status: { in: ['pending', 'PENDING'] } },
      _sum: { amount: true },
      _count: { id: true }
    }),
    prisma.withdrawal.aggregate({
      where: { status: { in: ['pending', 'PENDING'] } },
      _sum: { amount: true },
      _count: { id: true }
    }),
    prisma.deposit.aggregate({
      where: { status: { in: ['approved', 'completed', 'APPROVED', 'COMPLETED'] } },
      _sum: { amount: true }
    }),
    prisma.withdrawal.aggregate({
      where: { status: { in: ['approved', 'completed', 'APPROVED', 'COMPLETED'] } },
      _sum: { amount: true }
    })
  ]);

  const result = {
    pendingDepositsCount: pendingDeps._count.id || 0,
    pendingDepositsSum: Number(pendingDeps._sum.amount || 0),
    pendingWithdrawalsCount: pendingWds._count.id || 0,
    pendingWithdrawalsSum: Number(pendingWds._sum.amount || 0),
    totalDeposited: Number(approvedDepsAgg._sum.amount || 0),
    totalWithdrawn: Number(completedWdsAgg._sum.amount || 0)
  };

  console.log("Mock API Response:", result);
  console.log("Types:", {
    pendingDepositsSum: typeof result.pendingDepositsSum,
    pendingWithdrawalsSum: typeof result.pendingWithdrawalsSum,
    totalDeposited: typeof result.totalDeposited,
    totalWithdrawn: typeof result.totalWithdrawn
  });
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
