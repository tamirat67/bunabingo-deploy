import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function clearPendingDeposits() {
  const adminId = 'ae913951-f2a1-40fd-bf4a-2cbd4b1811f0'; 
  
  try {
    const pending = await prisma.deposit.findMany({
      where: { status: 'pending' },
    });

    console.log(`Found ${pending.length} pending deposits.`);

    for (const d of pending) {
      // 1. Update deposit status
      await prisma.deposit.update({
        where: { id: d.id },
        data: { status: 'approved' }
      });

      // 2. Credit wallet
      if (d.userId) {
        const wallet = await prisma.wallet.findUnique({ where: { userId: d.userId } });
        if (wallet) {
          await prisma.wallet.update({
            where: { userId: d.userId },
            data: { 
              balance: { increment: d.amount },
              totalDeposited: { increment: d.amount }
            }
          });
          
          // 3. Create transaction
          await prisma.transaction.create({
            data: {
              userId: d.userId,
              type: 'DEPOSIT',
              amount: d.amount,
              balanceBefore: wallet.balance,
              balanceAfter: Number(wallet.balance) + Number(d.amount),
              referenceId: d.id,
              status: 'COMPLETED',
              description: 'Backlog recovery auto-approval'
            }
          });

          // 4. Add 50% bonus
          const bonus = Number(d.amount) * 0.5;
          await prisma.wallet.update({
            where: { userId: d.userId },
            data: { 
              bonusBalance: { increment: bonus }
            }
          });

          // 5. Admin Log
          await prisma.adminLog.create({
            data: {
              adminId: adminId,
              targetUserId: d.userId,
              action: 'APPROVE_DEPOSIT',
              details: { depositId: d.id, amount: d.amount, note: 'BACKLOG_CLEARANCE' }
            }
          });
        }
      }
      console.log(`✅ Approved ${d.id}`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

clearPendingDeposits();
