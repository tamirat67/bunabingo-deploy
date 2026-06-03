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

    // resolvedGameId is populated by the first try-block (occupied sync) and
    // reused by the second try-block (countdown sync) so both use the same UUID.
    let resolvedGameId = '';

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

      resolvedGameId = gameId; // share with countdown sync block below

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

    // ── Sync mid-countdown state to joining/reconnecting clients ──────────────
    // Uses the resolved UUID (resolvedGameId) so activeGames lookup always works,
    // even when the client joined with a room-type string like 'CASUAL'.
    try {
      const { getActiveGames } = await import('../game/engine');
      const lookupId = resolvedGameId || gameOrRoom;
      const state = getActiveGames().get(lookupId);

      if (state && state.secondsRemaining !== undefined && state.secondsRemaining > 0) {
        // Fallback calculation just in case, but prefer the exact target time
        const endTime = state.countdownTargetTime ?? (Date.now() + state.secondsRemaining * 1000);
        socket.emit('countdown-start', {
          seconds: state.secondsRemaining,
          playerCount: state.ticketCount ?? 1,
          endTime,
          serverTime: Date.now(),
        });
        logger.info(`[Socket] Sent mid-countdown sync to ${socket.id}: ${state.secondsRemaining}s remaining`);
      } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lookupId)) {
        // DB fallback: state not yet in memory (e.g. first tick hasn't fired after resumeActiveCountdowns)
        const { default: prisma } = await import('./prisma');
        const game = await prisma.game.findUnique({
          where: { id: lookupId },
          select: { status: true, countdownSeconds: true }
        });
        if (game?.status === 'COUNTDOWN' && game.countdownSeconds && game.countdownSeconds > 0) {
          const endTime = Date.now() + game.countdownSeconds * 1000;
          socket.emit('countdown-start', {
            seconds: game.countdownSeconds,
            playerCount: 1,
            endTime,
            serverTime: Date.now(),
          });
          logger.info(`[Socket] DB fallback countdown sync to ${socket.id}: ${game.countdownSeconds}s`);
        }
      }
    } catch (e) {
      logger.warn(`[Socket] Could not sync countdown state for game ${gameOrRoom}:`, e);
    }

    // ── Sync RUNNING game start-time to late-joining clients ──────────────────
    // If the game is already RUNNING, tell the client when it started so
    // every device computes the exact same position inside the 20-second
    // poll cycle — no more independent clocks drifting apart.
    try {
      const { default: prisma } = await import('./prisma');
      const lookupId = resolvedGameId || gameOrRoom;
      if (lookupId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lookupId)) {
        const game = await prisma.game.findUnique({
          where: { id: lookupId },
          select: { status: true, startedAt: true }
        });
        if (game?.status === 'RUNNING' && game.startedAt) {
          socket.emit('game-running-sync', {
            gameStartedAt: game.startedAt.getTime(),
            serverTime: Date.now(),
            cycleSeconds: 20,
          });
          logger.info(`[Socket] Sent game-running-sync to ${socket.id}, startedAt=${game.startedAt.toISOString()}`);
        }
      }
    } catch (e) {
      logger.warn(`[Socket] Could not sync running-game state for ${gameOrRoom}:`, e);
    }
  });


    socket.on('leave-game', (gameId: string) => {
      socket.leave(`game_${gameId}`);
      logger.info(`[Socket] Socket ${socket.id} left game room: ${gameId}`);
    });

    socket.on('claim-bingo', async (data: { gameId: string }) => {
      const gId = data?.gameId;
      if (!userId || !gId) return;
      
      try {
        const { claimBingoWin } = await import('../game/engine');
        // Engine's claimBingoWin handles validation and triggering the global game-ended event
        await claimBingoWin(gId, userId);
        socket.emit('claim-success', { gameId: gId });
      } catch (err: any) {
        logger.warn(`[Socket Claim] User ${userId} failed to claim ${gId}: ${err.message}`);
        socket.emit('claim-error', { message: err.message });
      }
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
