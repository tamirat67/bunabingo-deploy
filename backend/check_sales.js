const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSales() {
  const sales = await prisma.transaction.findMany({
    where: { 
      type: 'TICKET_PURCHASE', 
      status: { in: ['completed', 'COMPLETED'] }
    },
    include: { user: { select: { username: true, firstName: true } } }
  });

  console.log('--- Ticket Purchase Transactions ---');
  sales.forEach(s => {
    console.log(`- User: ${s.user?.username || s.user?.firstName}, Amount: ${s.amount}, Date: ${s.createdAt}`);
  });

  const total = sales.reduce((acc, s) => acc + Number(s.amount), 0);
  console.log(`\nTotal Global Sales: ${total} ETB`);
}

checkSales().finally(() => prisma.$disconnect());
