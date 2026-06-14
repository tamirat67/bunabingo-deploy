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
    // IMPORTANT: When the client joins via room-type string (e.g. 'STANDARD'),
    // resolvedGameId points to the WAITING game — so we MUST also check explicitly
    // for a RUNNING game in the same room to fire this sync correctly.
    try {
      const { default: prisma } = await import('./prisma');
      const isRoomTypeJoin = ['DEMO', 'CASUAL', 'STANDARD', 'PRO', 'JACKPOT', 'VIP'].includes(gameOrRoom) || gameOrRoom.startsWith('SPIN_');

      let runningGame: { id: string; status: string; startedAt: Date | null } | null = null;

      if (isRoomTypeJoin) {
        // For room-type joins, look up the room and find any RUNNING game directly
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const room = await prisma.room.findFirst({ where: { type: gameOrRoom as any, isActive: true }, select: { id: true } });
        if (room) {
          runningGame = await prisma.game.findFirst({
            where: { roomId: room.id, status: 'RUNNING', startedAt: { gte: tenMinutesAgo } },
            select: { id: true, status: true, startedAt: true },
          });
        }
      } else {
        // For UUID joins, check the specific game directly
        const lookupId = resolvedGameId || gameOrRoom;
        if (lookupId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lookupId)) {
          runningGame = await prisma.game.findUnique({
            where: { id: lookupId },
            select: { id: true, status: true, startedAt: true },
          });
          if (runningGame?.status !== 'RUNNING') runningGame = null;
        }
      }

      if (runningGame && runningGame.startedAt) {
        // Auto-join this socket to the running game's channel so it receives number-drawn,
        // game-finished etc. even though it joined via room-type string
        socket.join(`game_${runningGame.id}`);
        socket.emit('game-running-sync', {
          gameId: runningGame.id,
          gameStartedAt: runningGame.startedAt.getTime(),
          serverTime: Date.now(),
          cycleSeconds: 50,
        });
        logger.info(`[Socket] Sent game-running-sync to ${socket.id} (joined via ${gameOrRoom}), runningGameId=${runningGame.id}, startedAt=${runningGame.startedAt.toISOString()}`);
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
        const { default: prisma } = await import('./prisma');
        let dbUserId = userId;
        
        // If the socket connected with a Telegram ID (numeric), look up the real UUID
        if (/^\d+$/.test(userId)) {
          const user = await prisma.user.findUnique({
            where: { telegramId: BigInt(userId) },
            select: { id: true }
          });
          if (!user) throw new Error('User not found');
          dbUserId = user.id;
        }

        const { claimBingoWin } = await import('../game/engine');
        // Engine's claimBingoWin handles validation and triggering the global game-ended event
        await claimBingoWin(gId, dbUserId);
        socket.emit('claim-success', { gameId: gId });
      } catch (err: any) {
        logger.warn(`[Socket Claim] User ${userId} failed to claim ${gId}: ${err.message}`);
        socket.emit('claim-error', { message: err.message });
      }
    });

    socket.on('join-roulette', async () => {
      socket.join('game_roulette');
      logger.info(`[Socket] Socket ${socket.id} joined roulette channel`);
      
      try {
        const { rouletteEngine } = await import('../game/roulette.engine');
        socket.emit('roulette-state', {
          status: rouletteEngine.status,
          secondsRemaining: rouletteEngine.secondsRemaining,
          bets: rouletteEngine.bets,
          history: rouletteEngine.history,
          currentResult: rouletteEngine.currentResult
        });
      } catch (e) {
        logger.warn('[Socket] Could not send roulette state:', e);
      }
    });

    socket.on('leave-roulette', () => {
      socket.leave('game_roulette');
      logger.info(`[Socket] Socket ${socket.id} left roulette channel`);
    });

    socket.on('roulette-place-bet', async (data: { amount: number, betType: string, betValue: string }) => {
      if (!userId) return;
      try {
        const { default: prisma } = await import('./prisma');
        let dbUserId = userId;
        
        // If the socket connected with a Telegram ID (numeric), look up the real UUID
        if (/^\d+$/.test(userId)) {
          const user = await prisma.user.findUnique({
            where: { telegramId: BigInt(userId) },
            select: { id: true }
          });
          if (!user) throw new Error('User not found');
          dbUserId = user.id;
        }

        const { rouletteEngine } = await import('../game/roulette.engine');
        await rouletteEngine.placeBet(dbUserId, data.amount, data.betType, data.betValue);
        socket.emit('roulette-bet-success');
      } catch (err: any) {
        logger.warn(`[Socket Roulette] User ${userId} failed to bet: ${err.message}`);
        socket.emit('roulette-bet-error', { message: err.message });
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
