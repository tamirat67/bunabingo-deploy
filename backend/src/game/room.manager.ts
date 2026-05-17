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
      type: RoomType.DEMO,
      ticketPrice: (config.game.ticketPrice as any).DEMO,
      minPlayers: (config.game.minPlayers as any).DEMO,
      maxPlayers: 100,
    },
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
    {
      type: RoomType.VIP,
      ticketPrice: config.game.ticketPrice.VIP,
      minPlayers: config.game.minPlayers.VIP,
      maxPlayers: 500,
    },
    {
      type: RoomType.SPIN_10,
      ticketPrice: 10,
      minPlayers: 10,
      maxPlayers: 100,
    },
    {
      type: RoomType.SPIN_20,
      ticketPrice: 20,
      minPlayers: 10,
      maxPlayers: 100,
    },
    {
      type: RoomType.SPIN_50,
      ticketPrice: 50,
      minPlayers: 10,
      maxPlayers: 100,
    },
    {
      type: RoomType.SPIN_100,
      ticketPrice: 100,
      minPlayers: 10,
      maxPlayers: 100,
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

let cachedRooms: any[] | null = null;
let lastCacheTime = 0;
const CACHE_DURATION_MS = 1500; // 1.5 seconds memory cache

export async function getRooms() {
  const now = Date.now();
  if (cachedRooms && (now - lastCacheTime < CACHE_DURATION_MS)) {
    return cachedRooms;
  }

  const rooms = await prisma.room.findMany({
    where: { isActive: true },
    include: {
      games: {
        where: { status: { in: ['WAITING', 'COUNTDOWN', 'RUNNING'] } },
        include: { 
          tickets: {
            select: { id: true, userId: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 2, // Allow seeing the current running game and the next waiting game
      },
    },
  });

  cachedRooms = rooms;
  lastCacheTime = now;
  return rooms;
}

export async function getRoomWithActiveGame(roomType: RoomType) {
  const room = await prisma.room.findFirst({
    where: { type: roomType, isActive: true },
    include: {
      games: {
        where: { status: { in: ['WAITING', 'COUNTDOWN', 'RUNNING'] } },
        include: { tickets: { select: { userId: true } } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
  return room;
}
