import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import { config } from '../config';
import { triggerGameEvent, triggerUserEvent, triggerAdminEvent } from '../lib/pusher';
import { generateBingoCard, checkWin, BingoCard } from './card.generator';
import { Decimal } from '@prisma/client/runtime/library';
import { RoomType, GameStatus } from '@prisma/client';
import { PREDEFINED_CARDS } from '../lib/predefinedCards';
import { awardCoins, XP_REWARDS } from '../services/wallet.service';
import { contributeToJackpot, checkJackpotWin } from '../services/jackpot.service';

interface ActiveGame {
  gameId: string;
  roomType: RoomType;
  drawnNumbers: number[];
  drawInterval?: NodeJS.Timeout;
  countdownTimer?: NodeJS.Timeout;
  countdownInterval?: NodeJS.Timeout;
  secondsRemaining?: number;
  numberPool: number[];
}

const activeGames = new Map<string, ActiveGame>();

// ─── Number Pool ──────────────────────────────────────────────
function buildNumberPool(): number[] {
  const pool = Array.from({ length: 75 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

// ─── Determine Countdown ──────────────────────────────────────
function getCountdownSeconds(playerCount: number): number {
  return (config.game.countdown as any).default || 60;
}

// ─── Start Countdown ──────────────────────────────────────────
export async function startCountdown(gameId: string, playerCount: number): Promise<void> {
  const seconds = getCountdownSeconds(playerCount);

  await prisma.game.update({
    where: { id: gameId },
    data: {
      status: GameStatus.COUNTDOWN,
      countdownSeconds: seconds,
    },
  });

  let existing = activeGames.get(gameId);
  if (!existing) {
    existing = {
      gameId,
      roomType: 'CASUAL',
      drawnNumbers: [],
      numberPool: buildNumberPool(),
    };
    activeGames.set(gameId, existing);
  }

  existing.secondsRemaining = seconds;

  // Initial broadcast
  await triggerGameEvent(gameId, 'countdown-start', { seconds, playerCount });
  logger.info(`[Game ${gameId}] Countdown started: ${seconds}s for ${playerCount} players`);

  // Clear any existing timer/interval
  if (existing.countdownInterval) clearInterval(existing.countdownInterval);
  if (existing.countdownTimer) clearTimeout(existing.countdownTimer);

  // Set up the tick interval
  existing.countdownInterval = setInterval(async () => {
    if (existing!.secondsRemaining! > 0) {
      existing!.secondsRemaining!--;
      
      // Get current ticket count for "players count" display
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { tickets: true }
      });
      const currentTicketCount = game?.tickets.length || 0;

      await triggerGameEvent(gameId, 'countdown-tick', { 
        secondsRemaining: existing!.secondsRemaining,
        playerCount: currentTicketCount 
      });
    } else {
      if (existing!.countdownInterval) {
        clearInterval(existing!.countdownInterval);
        existing!.countdownInterval = undefined;
      }
      runGame(gameId);
    }
  }, 1000);
}

// ─── Run Game ─────────────────────────────────────────────────
async function runGame(gameId: string): Promise<void> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { room: true, tickets: true },
  });

  if (!game || game.status === GameStatus.CANCELLED) return;

  // Ensure 10+ TICKETS and 2+ UNIQUE players still in game
  const ticketCount = game.tickets.length;
  const uniquePlayers = await prisma.ticket.groupBy({ where: { gameId }, by: ['userId'] });
  
  if (game.room.type !== 'DEMO') {
    if (ticketCount < game.room.minPlayers || uniquePlayers.length < 2) {
      await cancelGame(gameId, `Not enough players or tickets to start (Min ${game.room.minPlayers} tickets, 2 players)`);
      return;
    }
  }

  // ─── Special Handling for SPIN rooms (Raffle Draw) ──────────────────────────
  if (game.room.type.startsWith('SPIN_')) {
     await runSpinRaffle(gameId);
     return;
  }

  // ─── CHARGE PLAYERS NOW (game is actually starting) ─────────────────────────
  // Balance was only validated at join time — deduct here so users aren't charged
  // for games that never start or get cancelled.
  const unitPrice = game.room.ticketPrice;
  const houseEdgePercent = config.game.houseEdgePercent;
  let totalPrizePool = new Decimal(0);
  let totalHouseEdge = new Decimal(0);

  // Group tickets by user so we charge once per user for their total ticket count
  const ticketsByUser = new Map<string, typeof game.tickets>();
  for (const ticket of game.tickets) {
    const existing = ticketsByUser.get(ticket.userId) || [];
    existing.push(ticket);
    ticketsByUser.set(ticket.userId, existing);
  }

  for (const [userId, userTickets] of ticketsByUser) {
    const numTickets = userTickets.length;
    const totalCharge = new Decimal(unitPrice).mul(numTickets);
    const houseEdge = totalCharge.mul(houseEdgePercent).div(100);
    const prizeContribution = totalCharge.sub(houseEdge);

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      logger.error(`[Game ${gameId}] Wallet not found for user ${userId} — skipping charge`);
      continue;
    }

    // Re-validate balance at game start (edge case: user spent balance elsewhere)
    if (new Decimal(wallet.balance).lessThan(totalCharge)) {
      logger.warn(`[Game ${gameId}] User ${userId} has insufficient balance at game start — removing tickets`);
      await prisma.ticket.deleteMany({ where: { gameId, userId } });
      continue;
    }

    const newBalance = new Decimal(wallet.balance).sub(totalCharge);

    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { userId },
        data: {
          balance: newBalance,
          totalSpent: new Decimal(wallet.totalSpent).add(totalCharge),
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'TICKET_PURCHASE',
          amount: totalCharge,
          balanceBefore: wallet.balance,
          balanceAfter: newBalance,
          status: 'COMPLETED',
          referenceId: gameId,
          description: `Game started — ${numTickets} ticket(s) charged for ${game.room.type}`,
        },
      });
    });

    totalPrizePool = totalPrizePool.add(prizeContribution);
    totalHouseEdge = totalHouseEdge.add(houseEdge);
    logger.info(`[Game ${gameId}] Charged ${totalCharge} ETB from user ${userId} (${numTickets} ticket(s))`);

    // Award XP for joining
    try {
      await awardCoins(userId, XP_REWARDS.JOIN_GAME * numTickets, `Joined game ${gameId} with ${numTickets} card(s)`);
    } catch (e) { logger.warn(`[Coins] Failed to award join XP to ${userId}:`, e); }
  }

  // Contribute to Global Jackpot
  try {
    await contributeToJackpot(game.tickets.length, unitPrice);
  } catch (e) { logger.error(`[Jackpot] Contribution failed:`, e); }

  // Update game prize pool with actual collected amounts
  await prisma.game.update({
    where: { id: gameId },
    data: {
      status: GameStatus.RUNNING,
      startedAt: new Date(),
      totalPrize: totalPrizePool,
      houseEdge: totalHouseEdge,
    },
  });

  let state = activeGames.get(gameId);
  if (!state) {
    state = {
      gameId,
      roomType: game.room.type,
      drawnNumbers: [],
      numberPool: buildNumberPool(),
    };
    activeGames.set(gameId, state);
  }

  await triggerGameEvent(gameId, 'game-started', { gameId, playerCount: game.tickets.length });
  logger.info(`[Game ${gameId}] Game RUNNING with ${game.tickets.length} tickets. Prize pool: ${totalPrizePool} ETB`);

  // Start draw loop
  state.drawInterval = setInterval(() => drawNumber(gameId), config.game.drawIntervalMs);
}

/**
 * Shared Raffle logic for Spin rooms:
 * Picks one winner from the sold tickets and ends the game immediately.
 */
async function runSpinRaffle(gameId: string): Promise<void> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { tickets: { include: { user: true } }, room: true }
  });

  if (!game || game.tickets.length < 10) return;

  // 1. Pick a random ticket as the winner
  const winnerTicket = game.tickets[Math.floor(Math.random() * game.tickets.length)];
  const winnerCardId = (winnerTicket.card as any).id || 1;
  const winnerUserId = winnerTicket.userId;

  // 2. Calculate prize: Total pool minus house edge
  const totalPool = new Decimal(game.totalPrize);
  // Note: game.totalPrize already has house edge deducted during joinGame
  const prizeAmount = totalPool;

  await prisma.$transaction(async (tx) => {
    // 3. Mark winner and game status
    await tx.winner.create({
      data: {
        gameId,
        userId: winnerUserId,
        ticketId: winnerTicket.id,
        winMode: 'FULL_HOUSE', // Shared raffle counts as full house for history
        prizeAmount
      }
    });

    await tx.ticket.update({
      where: { id: winnerTicket.id },
      data: { isWinner: true }
    });

    await tx.game.update({
      where: { id: gameId },
      data: { 
        status: GameStatus.FINISHED, 
        finishedAt: new Date(),
        startedAt: new Date()
      }
    });

    // 4. Credit wallet
    const wallet = await tx.wallet.findUnique({ where: { userId: winnerUserId } });
    if (wallet) {
      const before = wallet.balance;
      const after = new Decimal(wallet.balance).add(prizeAmount);

      await tx.wallet.update({
        where: { userId: winnerUserId },
        data: {
          balance: after,
          totalWon: new Decimal(wallet.totalWon).add(prizeAmount)
        }
      });

      await tx.transaction.create({
        data: {
          userId: winnerUserId,
          type: 'PRIZE_WIN',
          amount: prizeAmount,
          balanceBefore: before,
          balanceAfter: after,
          status: 'COMPLETED',
          referenceId: gameId,
          description: `Spin Raffle WIN: Card #${winnerCardId}`
        }
      });
    }
  });

  // 5. Broadcast to all players in the room
  await triggerGameEvent(gameId, 'spin-result', {
    winnerCardId,
    winnerUserId,
    prizeAmount: prizeAmount.toFixed(2),
    soldCards: game.tickets.map(t => (t.card as any).id)
  });

  logger.info(`[Spin ${gameId}] Raffle winner: Card #${winnerCardId} (User ${winnerUserId})`);
}


// ─── Draw Number ──────────────────────────────────────────────
async function drawNumber(gameId: string): Promise<void> {
  const state = activeGames.get(gameId);
  if (!state) return;

  if (state.numberPool.length === 0) {
    await finishGame(gameId, 'All numbers drawn');
    return;
  }

  const number = state.numberPool.pop()!;
  state.drawnNumbers.push(number);

  // Save to DB
  const sequence = state.drawnNumbers.length;
  await prisma.drawHistory.create({
    data: { gameId, number, sequence },
  });

  await triggerGameEvent(gameId, 'number-drawn', {
    number,
    sequence,
    totalDrawn: state.drawnNumbers.length,
  });

  logger.debug(`[Game ${gameId}] Drew #${number} (${sequence}th)`);

  // Check all tickets for winners
  await checkAllTickets(gameId, state.drawnNumbers);
}

// ─── Check All Tickets ────────────────────────────────────────
async function checkAllTickets(gameId: string, drawnNumbers: number[]): Promise<void> {
  const tickets = await prisma.ticket.findMany({
    where: { gameId, isWinner: false },
    include: { user: true },
  });

  const existingWinners = await prisma.winner.findMany({ where: { gameId } });
  const existingWinModes = new Set(existingWinners.map(w => w.winMode));

  for (const ticket of tickets) {
    const cardData = ticket.card as any;
    const rows = Array.isArray(cardData) ? cardData : cardData.rows;
    const result = checkWin(rows as BingoCard, drawnNumbers);

    if (result.won) {
      for (const mode of result.modes) {
        if (!existingWinModes.has(mode as any)) {
          await processWinner(gameId, ticket.userId, ticket.id, mode as any, drawnNumbers);
          existingWinModes.add(mode as any);
        }
      }
    }

    // Update marked numbers
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { markedNumbers: drawnNumbers },
    });
  }

  // If full house found → end game
  if (existingWinModes.has('FULL_HOUSE')) {
    clearInterval(activeGames.get(gameId)?.drawInterval);
    await finishGame(gameId, 'Full house winner found');
  }
}

// ─── Process Winner ───────────────────────────────────────────
async function processWinner(
  gameId: string,
  userId: string,
  ticketId: string,
  winMode: any,
  drawnNumbers: number[]
): Promise<void> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { tickets: true },
  });
  if (!game) return;

  // Prize logic: partial prizes per mode
  const prizePercents: Record<string, number> = {
    ROW: 10,
    COLUMN: 10,
    DIAGONAL: 15,
    FOUR_CORNERS: 15,
    FULL_HOUSE: 50,
  };
  const percent = prizePercents[winMode] ?? 10;
  const prizeAmount = new Decimal(game.totalPrize).mul(percent).div(100);

  // Record winner
  await prisma.winner.create({
    data: { gameId, userId, ticketId, winMode, prizeAmount },
  });

  // Credit wallet
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (wallet) {
    const before = wallet.balance;
    const after = new Decimal(wallet.balance).add(prizeAmount);

    await prisma.wallet.update({
      where: { userId },
      data: {
        balance: after,
        totalWon: new Decimal(wallet.totalWon).add(prizeAmount),
      },
    });

    await prisma.transaction.create({
      data: {
        userId,
        type: 'PRIZE_WIN',
        amount: prizeAmount,
        balanceBefore: before,
        balanceAfter: after,
        status: 'COMPLETED',
        referenceId: gameId,
        description: `Bingo WIN: ${winMode}`,
      },
    });
  }

  await prisma.ticket.update({ where: { id: ticketId }, data: { isWinner: true } });

  // Award XP for winning
  const xpKey = `WIN_${winMode}` as keyof typeof XP_REWARDS;
  const xpAmount = XP_REWARDS[xpKey] ?? XP_REWARDS.WIN_ROW;
  try {
    await awardCoins(userId, xpAmount, `Bingo WIN: ${winMode} in game ${gameId}`);
  } catch (e) { logger.warn(`[Coins] Failed to award win XP to ${userId}:`, e); }

  // ─── CHECK JACKPOT ───
  if (winMode === 'FULL_HOUSE') {
    try {
      const jackpotWin = await checkJackpotWin(userId, ticketId, winMode, drawnNumbers.length);
      if (jackpotWin) {
        logger.info(`🔥 JACKPOT! User ${userId} won ${jackpotWin} ETB!`);
        // Notify user specifically
        await triggerUserEvent(userId, 'jackpot-alert', { amount: jackpotWin.toFixed(2) });
      }
    } catch (e) { logger.error(`[Jackpot] Win check failed:`, e); }
  }

  await triggerGameEvent(gameId, 'winner-announced', {
    userId,
    winMode,
    prizeAmount: prizeAmount.toFixed(2),
    drawnNumbers,
  });

  await triggerUserEvent(userId, 'prize-received', {
    gameId,
    winMode,
    amount: prizeAmount.toFixed(2),
  });

  logger.info(`[Game ${gameId}] Winner: user ${userId} — ${winMode} — Prize: ${prizeAmount}`);
}

// ─── Finish Game ──────────────────────────────────────────────
async function finishGame(gameId: string, reason: string): Promise<void> {
  const state = activeGames.get(gameId);
  if (state?.drawInterval) clearInterval(state.drawInterval);
  if (state?.countdownTimer) clearTimeout(state.countdownTimer);
  if (state?.countdownInterval) clearInterval(state.countdownInterval);
  activeGames.delete(gameId);

  await prisma.game.update({
    where: { id: gameId },
    data: { status: GameStatus.FINISHED, finishedAt: new Date() },
  });

  const winners = await prisma.winner.findMany({
    where: { gameId },
    include: { user: { select: { firstName: true, telegramUsername: true } } },
  });

  await triggerGameEvent(gameId, 'game-finished', { gameId, reason, winners });
  await triggerAdminEvent('game-finished', { gameId, reason });
  logger.info(`[Game ${gameId}] Finished: ${reason}`);

  // Auto-create new waiting game for the same room
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (game) {
    await createWaitingGame(game.roomId);
  }
}

// ─── Cancel Game ──────────────────────────────────────────────
export async function cancelGame(gameId: string, reason: string): Promise<void> {
  const state = activeGames.get(gameId);
  if (state?.drawInterval) clearInterval(state.drawInterval);
  if (state?.countdownTimer) clearTimeout(state.countdownTimer);
  if (state?.countdownInterval) clearInterval(state.countdownInterval);
  activeGames.delete(gameId);

  await prisma.game.update({
    where: { id: gameId },
    data: { status: GameStatus.CANCELLED, cancelledAt: new Date(), cancelReason: reason },
  });

  // No refunds needed — balance is only deducted when the game STARTS (in runGame).
  // Cancelled games never charged players, so we just notify them.
  const tickets = await prisma.ticket.findMany({ where: { gameId } });
  const notifiedUsers = new Set<string>();
  for (const ticket of tickets) {
    if (!notifiedUsers.has(ticket.userId)) {
      await triggerUserEvent(ticket.userId, 'game-cancelled', { gameId, reason });
      notifiedUsers.add(ticket.userId);
    }
  }

  await triggerGameEvent(gameId, 'game-cancelled', { gameId, reason });
  logger.info(`[Game ${gameId}] Cancelled: ${reason} (no charges were made)`);
}

// ─── Create Waiting Game ──────────────────────────────────────
export async function createWaitingGame(roomId: string): Promise<string> {
  // Check if there's already a waiting game for this room
  const existing = await prisma.game.findFirst({
    where: { roomId, status: GameStatus.WAITING },
  });
  if (existing) return existing.id;

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new Error('Room not found');

  const game = await prisma.game.create({
    data: {
      roomId,
      status: GameStatus.WAITING,
      totalPrize: 0,
      houseEdge: 0,
    },
  });

  logger.info(`[Room ${roomId}] New waiting game created: ${game.id}`);
  return game.id;
}


// ─── Join Game ────────────────────────────────────────────────
export async function joinGame(
  userId: string,
  gameId: string,
  cardIds: number[] = [1] // Default to card 1 if not provided
): Promise<{ tickets: any[]; cards: BingoCard[] }> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { room: true, tickets: true },
  });

  if (!game) throw new Error('Game not found');
  if (game.status !== GameStatus.WAITING && game.status !== GameStatus.COUNTDOWN) {
    throw new Error('Game is not accepting players');
  }

  const numTickets = cardIds.length;
  if (numTickets === 0) throw new Error('No cards selected');
  if (numTickets > 5) throw new Error('Maximum of 5 cards allowed per player');
  
  // Check if any cards are already taken by other users in this game
  const occupiedTickets = await prisma.ticket.findMany({
    where: { 
      gameId,
      userId: { not: userId } 
    },
    select: { card: true }
  });
  const takenIds = occupiedTickets.map(t => (t.card as any).id);
  const duplicates = cardIds.filter(id => takenIds.includes(id));
  if (duplicates.length > 0) {
    throw new Error(`Cartela(s) #${duplicates.join(', #')} are already taken by another player!`);
  }

  // Clear any existing tickets for this user in this game before adding new ones
  // This prevents 'garbage' or old selections from persisting if the user re-joins
  if (game.status === GameStatus.WAITING || game.status === GameStatus.COUNTDOWN) {
    await prisma.ticket.deleteMany({
      where: { userId, gameId }
    });
  }

  // Validate and prepare cards
  const preparedCards: { id: number, pattern: BingoCard }[] = [];
  for (const cardId of cardIds) {
    const normalizedId = Math.max(1, Math.min(100, cardId));
    const pattern = PREDEFINED_CARDS[normalizedId];
    if (!pattern) throw new Error(`Invalid card selection: ${cardId}`);
    
    preparedCards.push({
      id: normalizedId,
      pattern: pattern.map(row => row.map(cell => cell === 0 ? 'FREE' : cell)) as any
    });
  }

  // ── Balance check only — do NOT deduct here ─────────────────────────────────
  // Deduction happens in runGame() when the game actually starts.
  // This way users are never charged for games that get cancelled.
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error('Wallet not found');

  const unitPrice = game.room.ticketPrice;
  const totalPrice = new Decimal(unitPrice).mul(numTickets);

  if (new Decimal(wallet.balance).lessThan(totalPrice)) {
    throw new Error(`Insufficient balance. You need ${totalPrice} ETB.`);
  }

  // Create tickets only (no wallet changes)
  const results = await prisma.$transaction(async (tx) => {
    // 1. Create Tickets
    const tickets = await Promise.all(preparedCards.map(c =>
      tx.ticket.create({
        data: {
          userId,
          gameId,
          card: { id: c.id, rows: c.pattern } as any,
          markedNumbers: []
        }
      })
    ));

    // 2. Update Room player count (for lobby display)
    await tx.room.update({
      where: { id: game.roomId },
      data: { currentPlayers: { increment: numTickets } }
    });

    return { tickets };
  });

  // Update room player count logic
  const updatedGame = await prisma.game.findUnique({
    where: { id: gameId },
    include: { tickets: true },
  });
  const playerCount = updatedGame?.tickets.length ?? 0; // Total tickets in game

  try {
    const currentState = activeGames.get(gameId);
    await triggerGameEvent(gameId, 'player-joined', { 
      userId, 
      playerCount, 
      numTickets,
      secondsRemaining: currentState?.secondsRemaining 
    });
    await triggerGameEvent(game.roomId, 'player-count-update', { playerCount });
    await triggerGameEvent(game.roomId, 'card-occupied', { 
      occupiedIds: (await prisma.ticket.findMany({ where: { gameId }, select: { card: true } })).map(t => (t.card as any).id) 
    });
    await triggerAdminEvent('player-joined', { gameId, userId, playerCount });
  } catch (e) {
    logger.error('Pusher notification failed but join succeeded:', e);
  }

  // Auto-start countdown if enough TICKETS join (and at least 2 unique users)
  const minTickets = game.room.minPlayers; // We use minPlayers field to store minTickets requirement
  const totalTickets = playerCount;
  const uniquePlayers = await prisma.ticket.groupBy({
    where: { gameId },
    by: ['userId']
  });
  
  if (totalTickets >= minTickets && uniquePlayers.length >= 2) {
    const currentState = activeGames.get(gameId);
    if (!currentState?.countdownTimer) {
      try {
        await startCountdown(gameId, uniquePlayers.length);
      } catch (e) {
        logger.error('Countdown start failed:', e);
      }
    }
  }

  return { tickets: results.tickets, cards: preparedCards.map(c => c.pattern) };
}

export function getActiveGames(): Map<string, ActiveGame> {
  return activeGames;
}
