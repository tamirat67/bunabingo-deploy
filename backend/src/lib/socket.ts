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

      const isRoomType = ['DEMO', 'CASUAL', 'STANDARD', 'PRO', 'JACKPOT', 'VIP'].includes(gameOrRoom);
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
      const isRoomTypeJoin = ['DEMO', 'CASUAL', 'STANDARD', 'PRO', 'JACKPOT', 'VIP'].includes(gameOrRoom);

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


    // ── Card Reservation: player is pre-selecting cards (before purchase) ────────
    // Broadcast their pending selection to all other players so those cards
    // appear as occupied (green) — identical to bot/purchased cards.
    // cardIds=[] means the player deselected everything (acts as a full release).
    socket.on('card-select', async (data: { gameId: string; cardIds: number[]; roomType: string }) => {
      if (!userId) return;
      const { gameId, cardIds, roomType } = data || {};
      if (!gameId) return;

      try {
        const { reserveCards, getReservedCardIds } = await import('./cardReservations');

        let dbUserId = userId;
        // Resolve Telegram numeric ID to internal UUID if needed
        if (/^\d+$/.test(userId)) {
          const { default: prisma } = await import('./prisma');
          const user = await prisma.user.findUnique({
            where: { telegramId: BigInt(userId) },
            select: { id: true },
          });
          if (!user) return;
          dbUserId = user.id;
        }

        // Update reservations for this user (cardIds=[] clears all their reservations)
        reserveCards(gameId, cardIds ?? [], dbUserId, roomType || '');

        // Broadcast the updated full reserved list to ALL players in this game room.
        // Each client merges this into their local "occupied" state.
        const allReservedIds = getReservedCardIds(gameId); // no excludeUserId — broadcast all
        if (io) {
          io.to(`game_${gameId}`).emit('cards-reserved', {
            reservedIds: allReservedIds,
            gameId,
          });
        }
      } catch (e) {
        logger.warn(`[Socket] card-select handler failed for user ${userId}:`, e);
      }
    });

    // On disconnect: release all reservations this user holds across any game.
    // This mirrors the "player closed app" path — the frontend can't send card-select [].
    socket.on('disconnect', async () => {
      if (!userId) {
        logger.info(`[Socket] Client disconnected: ${socket.id}`);
        return;
      }
      logger.info(`[Socket] Client disconnected: ${socket.id} (userId=${userId})`);

      try {
        // We don't know which game(s) this user had reservations in,
        // so we let the 2-minute TTL handle cleanup naturally.
        // (Actively scanning all games on every disconnect is expensive at scale.)
        // The TTL is short enough (2 min) that cards free up quickly.
      } catch (e) {
        // silent
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
        const result = await claimBingoWin(gId, dbUserId);

        if (result.won) {
          // Player legitimately won — game-finished event fires globally from processWinner
          socket.emit('claim-success', { gameId: gId });
        } else {
          // Claim rejected (house-win block, no pattern, or game already won).
          // emit claim-error so the frontend silently resets the BINGO button.
          // The message "wait for more balls" is absorbed silently on the client
          // — no dialog shown, button quietly goes back to orange.
          logger.info(`[Socket Claim] User ${userId} claim rejected for ${gId}: ${result.error}`);
          socket.emit('claim-error', { message: result.error || 'No valid Bingo detected yet! Check your patterns or wait for more balls.' });
        }
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

// ═══════════════════════════════════════════════════════════════════════════
//  AVIATOR SOCKET NAMESPACE  (additive — does NOT touch any Bingo logic)
// ═══════════════════════════════════════════════════════════════════════════
//
// All Aviator events are prefixed "aviator:" on the server side so they
// can never collide with existing Bingo events (join-game, card-select…).
// The frontend sends "aviator:enterRoom", "aviator:playBet", etc.
//
// The AviatorService manages its own in-memory game state and only reads
// from / writes to the aviator_games + aviator_bets tables in Prisma.
//
export function initAviatorSocketHandlers(ioServer: SocketServer) {
  ioServer.on('connection', (socket) => {
    // ── Aviator: enter room ────────────────────────────────────────────────
    socket.on('aviator:enterRoom', async (data: { token?: string; userId?: string }) => {
      try {
        const { aviatorEnterRoom } = await import('../services/aviator.service');
        const userId = (data?.userId ?? socket.handshake.query.userId) as string;
        if (!userId) return;
        await aviatorEnterRoom(socket.id, userId, ioServer);
      } catch (err: any) {
        logger.warn('[Aviator Socket] enterRoom error:', err.message);
      }
    });

    // ── Aviator: place bet ─────────────────────────────────────────────────
    socket.on('aviator:playBet', async (data: {
      betAmount: number;
      target: number;
      type: 'f' | 's';
      auto?: boolean;
    }) => {
      try {
        const userId = socket.handshake.query.userId as string;
        if (!userId) return;
        const { aviatorPlaceBet } = await import('../services/aviator.service');
        const result = await aviatorPlaceBet(userId, data.betAmount, data.target ?? 0, data.type ?? 'f');
        if (!result.success) {
          socket.emit('aviator:error', { index: data.type ?? 'f', message: result.error });
        } else if (result.balance !== undefined) {
          socket.emit('balance-updated', { newBalance: result.balance });
        }
      } catch (err: any) {
        logger.warn('[Aviator Socket] playBet error:', err.message);
        socket.emit('aviator:error', { message: err.message });
      }
    });

    // ── Aviator: cash out ──────────────────────────────────────────────────
    socket.on('aviator:cashOut', async (data: { endTarget: number; type: 'f' | 's' }) => {
      try {
        const userId = socket.handshake.query.userId as string;
        if (!userId) return;
        const { aviatorCashOut } = await import('../services/aviator.service');
        const result = await aviatorCashOut(userId, data.endTarget, data.type ?? 'f');
        if (!result.success) {
          socket.emit('aviator:error', { index: data.type ?? 'f', message: result.error });
        } else if (result.balance !== undefined) {
          socket.emit('balance-updated', { newBalance: result.balance });
        }
      } catch (err: any) {
        logger.warn('[Aviator Socket] cashOut error:', err.message);
        socket.emit('aviator:error', { message: err.message });
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  KENO SOCKET NAMESPACE
// ═══════════════════════════════════════════════════════════════════════════

export function initKenoSocketHandlers(ioServer: SocketServer, drawEngine: any) {
  drawEngine.on("update", (update: any) => {
    ioServer.emit("keno:ROUND_UPDATE", update);
  });
}

