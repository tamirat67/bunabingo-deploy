const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const unassigned = await prisma.user.count({ where: { referredBy: null, isBot: false, role: 'PLAYER' } });
  console.log('Unassigned real players:', unassigned);
  
  const staff = await prisma.user.findFirst({
    where: {
      OR: [
        { telegramUsername: 'Luel1616' },
        { referralCode: 'AG-VL7MV' }
      ]
    }
  });
  console.log('Staff agent:', staff ? staff.id : 'not found');
  
  if (unassigned > 0 && staff) {
    const updated = await prisma.user.updateMany({
      where: { referredBy: null, isBot: false, role: 'PLAYER' },
      data: { referredBy: staff.id }
    });
    console.log('Updated users:', updated.count);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
