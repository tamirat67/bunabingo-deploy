import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from './logger';

let io: SocketServer | null = null;

export function initSocket(server: HttpServer) {
  io = new SocketServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId as string;
    if (userId) {
      socket.join(`user_${userId}`);
      logger.info(`[Socket] User ${userId} connected and joined private room.`);
    }

    socket.on('join-game', async (gameOrRoom: string) => {
      socket.join(`game_${gameOrRoom}`);
      logger.info(`[Socket] Socket ${socket.id} joined channel: ${gameOrRoom}`);

      // ── Real-Time Occupied Card Sync ───────────────────────────
      try {
        const { default: prisma } = await import('./prisma');
        const { getRoomWithActiveGame } = await import('../game/room.manager');

        let gameId = gameOrRoom;
        let room: any = null;

        const isRoomType = ['DEMO', 'CASUAL', 'STANDARD', 'PRO', 'JACKPOT', 'VIP'].includes(gameOrRoom) || gameOrRoom.startsWith('SPIN_');
        if (isRoomType) {
          room = await getRoomWithActiveGame(gameOrRoom as any);
          gameId = room?.games[0]?.id || '';
        } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gameOrRoom)) {
          const game = await prisma.game.findUnique({
            where: { id: gameOrRoom },
            include: { room: true }
          });
          gameId = game?.id || '';
          room = game?.room || null;
        } else {
          logger.warn(`[Socket] join-game skipped: invalid room/game format: ${gameOrRoom}`);
          return;
        }

        if (gameId && room) {
          const tickets = await prisma.ticket.findMany({
            where: { gameId },
            select: { card: true, userId: true }
          });

          const ticketData = tickets.map(t => ({
            cardId: (t.card as any).id,
            userId: t.userId
          }));

          socket.emit('occupied-sync', {
            tickets: ticketData,
            playerCount: new Set(tickets.map(t => t.userId)).size,
            gameId,
            roomId: room.id
          });
        }
      } catch (e) {
        logger.warn(`[Socket] Failed to send initial occupied sync for ${gameOrRoom}:`, e);
      }

      // ── Sync mid-countdown state to reconnecting clients ──────────────────
      try {
        const { getActiveGames } = await import('../game/engine');
        const state = getActiveGames().get(gameOrRoom);
        if (state && state.secondsRemaining !== undefined && state.secondsRemaining > 0) {
          const endTime = Date.now() + state.secondsRemaining * 1000;
          socket.emit('countdown-start', {
            seconds: state.secondsRemaining,
            playerCount: 1,
            endTime,
            serverTime: Date.now(),
          });
          logger.info(`[Socket] Sent mid-countdown sync to ${socket.id}: ${state.secondsRemaining}s remaining`);
        } else {
          const { default: prisma } = await import('./prisma');
          const game = await prisma.game.findUnique({
            where: { id: gameOrRoom },
            select: { status: true, countdownSeconds: true, createdAt: true }
          });
          if (game?.status === 'COUNTDOWN' && game.countdownSeconds && game.countdownSeconds > 0) {
            const elapsedSec = Math.floor((Date.now() - new Date(game.createdAt).getTime()) / 1000);
            const remaining = Math.max(0, game.countdownSeconds - elapsedSec);
            if (remaining > 0) {
              const endTime = Date.now() + remaining * 1000;
              socket.emit('countdown-start', {
                seconds: remaining,
                playerCount: 1,
                endTime,
                serverTime: Date.now(),
              });
              logger.info(`[Socket] DB fallback countdown sync to ${socket.id}: ~${remaining}s remaining`);
            }
          }
        }
      } catch (e) {
        logger.warn(`[Socket] Could not sync countdown state for game ${gameOrRoom}:`, e);
      }
    });

    socket.on('leave-game', (gameId: string) => {
      socket.leave(`game_${gameId}`);
      logger.info(`[Socket] Socket ${socket.id} left game room: ${gameId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error('Socket.io not initialized!');
  return io;
}

/**
 * Trigger an event for a specific user
 */
export function triggerSocketUserEvent(userId: string, event: string, data: any) {
  if (!io) return;
  io.to(`user_${userId}`).emit(event, data);
}

/**
 * Trigger an event for a specific game room
 */
export function triggerSocketGameEvent(gameId: string, event: string, data: any) {
  if (!io) return;
  io.to(`game_${gameId}`).emit(event, data);
}

/**
 * Global broadcast
 */
export function triggerSocketGlobalEvent(event: string, data: any) {
  if (!io) return;
  io.emit(event, data);
}
