import prisma from '../lib/prisma';
import { config } from '../config';
import { createWaitingGame } from '../game/engine';
import { RoomType } from '@prisma/client';

/**
 * Initialize default rooms on startup
 */
export async function initializeRooms(): Promise<void> {
  const rooms = [
    {
      type: RoomType.CASUAL,
      ticketPrice: config.game.ticketPrice.CASUAL,
      minPlayers: config.game.minPlayers.CASUAL,
      maxPlayers: 100,
    },
    {
      type: RoomType.STANDARD,
      ticketPrice: config.game.ticketPrice.STANDARD,
      minPlayers: config.game.minPlayers.STANDARD,
      maxPlayers: 200,
    },
    {
      type: RoomType.PRO,
      ticketPrice: config.game.ticketPrice.PRO,
      minPlayers: config.game.minPlayers.PRO,
      maxPlayers: 300,
    },
    {
      type: RoomType.JACKPOT,
      ticketPrice: config.game.ticketPrice.JACKPOT,
      minPlayers: config.game.minPlayers.JACKPOT,
      maxPlayers: 500,
    },
  ];

  for (const roomData of rooms) {
    let room = await prisma.room.findFirst({ where: { type: roomData.type } });
    if (!room) {
      room = await prisma.room.create({ data: roomData });
    } else {
      // Force sync the price and minPlayers if they changed
      room = await prisma.room.update({
        where: { id: room.id },
        data: { 
          ticketPrice: roomData.ticketPrice,
          minPlayers: roomData.minPlayers,
          isActive: true 
        }
      });
    }
    // Ensure there's always a waiting game in each room
    await createWaitingGame(room.id);
  }
}

export async function getRooms() {
  return prisma.room.findMany({
    where: { isActive: true },
    include: {
      games: {
        where: { status: { in: ['WAITING', 'COUNTDOWN'] } },
        include: { tickets: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
}

export async function getRoomWithActiveGame(roomType: RoomType) {
  const room = await prisma.room.findFirst({
    where: { type: roomType, isActive: true },
    include: {
      games: {
        where: { status: { in: ['WAITING', 'COUNTDOWN'] } },
        include: { tickets: { select: { userId: true } } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
  return room;
}
