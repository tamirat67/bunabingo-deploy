import { PrismaClient } from '@prisma/client';

async function tryQuery(url: string) {
  console.log(`Connecting to: ${url.split('@')[1]}...`);
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: url
      }
    }
  });

  try {
    // 1. Get recent 10 games
    const games = await prisma.game.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        room: { select: { type: true, ticketPrice: true } },
        winners: {
          include: {
            user: { select: { firstName: true, telegramUsername: true, isBot: true } }
          }
        },
        _count: { select: { tickets: true } }
      }
    });

    console.log(`Recent Games (${games.length}):`);
    for (const g of games) {
      const winnerDetails = g.winners.map(w => `${w.user.firstName} (bot=${w.user.isBot}, mode=${w.winMode}, prize=${w.prizeAmount})`).join(', ');
      console.log(`- Game ID: ${g.id}
        Room: ${g.room.type} (Price: ${g.room.ticketPrice})
        Status: ${g.status}
        Tickets: ${g._count.tickets}
        Winners: ${winnerDetails || 'None'}`);
    }

    // 2. Get game cycles
    const cycles = await prisma.gameCycle.findMany();
    console.log('\nGame Cycles (Win/Loss Tracking for Bots):');
    console.log(cycles);
    
    return true; // Success
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const urls = [
    // Neon live from vercel CLI env
    "postgresql://neondb_owner:npg_5c3hPqXvEnUM@ep-square-frog-alg2vwbr-pooler.c-3.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require",
    // Neon live from deployment manual
    "postgresql://neondb_owner:npg_gT4s6LNJFqhy@ep-blue-violet-ap6k9k4v-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require",
    // Local postgres:postgres
    "postgresql://postgres:postgres@localhost:5432/bunabingo?schema=public",
    // Local bunabingo_user
    "postgresql://bunabingo_user:SecurePasswordHere123!@localhost:5432/bunabingo?schema=public",
  ];

  for (let i = 0; i < urls.length; i++) {
    console.log(`\n--- DB QUERY TRYING URL #${i + 1} ---`);
    try {
      const ok = await tryQuery(urls[i]);
      if (ok) {
        console.log(`Successfully completed query using URL #${i + 1}`);
        return;
      }
    } catch (err: any) {
      console.error(`Attempt #${i + 1} failed: ${err.message || err}`);
    }
  }
}

main().catch(console.error);
