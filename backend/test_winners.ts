import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const games = await prisma.game.findMany({
    where: { status: 'FINISHED' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      winners: {
        include: {
          user: true,
          ticket: true
        }
      }
    }
  });

  for (const g of games) {
    console.log(`Game ${g.id}`);
    for (const w of g.winners) {
      console.log(`  Winner ${w.userId}`);
      console.log(`  Ticket:`, w.ticket ? 'Exists' : 'Null');
      if (w.ticket) {
         console.log(`  Ticket card typeof:`, typeof w.ticket.card);
         console.log(`  Ticket card value:`, JSON.stringify(w.ticket.card).substring(0, 100));
      }
    }
  }
}
run().finally(() => prisma.$disconnect());
