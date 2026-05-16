import { PrismaClient } from '@prisma/client';
import { config } from '../src/config';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  // Create rooms
  const rooms = [
    { type: 'CASUAL' as const,   ticketPrice: config.game.ticketPrice.CASUAL,   minPlayers: 2,  maxPlayers: 100 },
    { type: 'STANDARD' as const, ticketPrice: config.game.ticketPrice.STANDARD, minPlayers: 5,  maxPlayers: 200 },
    { type: 'JACKPOT' as const,  ticketPrice: config.game.ticketPrice.JACKPOT,  minPlayers: 20, maxPlayers: 500 },
  ];

  for (const room of rooms) {
    const existing = await prisma.room.findFirst({ where: { type: room.type } });
    if (!existing) {
      await prisma.room.create({ data: room });
      console.log(`✅ Created ${room.type} room`);
    }
  }

  // Create an initial waiting game for each room
  const allRooms = await prisma.room.findMany();
  for (const room of allRooms) {
    const existing = await prisma.game.findFirst({ where: { roomId: room.id, status: 'WAITING' } });
    if (!existing) {
      await prisma.game.create({ data: { roomId: room.id, status: 'WAITING', totalPrize: 0, houseEdge: 0 } });
      console.log(`✅ Created waiting game for ${room.type}`);
    }
  }

  console.log('✅ Seed complete!');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
