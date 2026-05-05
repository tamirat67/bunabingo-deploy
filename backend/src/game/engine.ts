import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import { config } from '../config';
import { triggerGameEvent, triggerUserEvent, triggerAdminEvent } from '../lib/pusher';
import { generateBingoCard, checkWin, BingoCard } from './card.generator';
import { Decimal } from '@prisma/client/runtime/library';
import { RoomType, GameStatus } from '@prisma/client';

interface ActiveGame {
  gameId: string;
  roomType: RoomType;
  drawnNumbers: number[];
  drawInterval?: NodeJS.Timeout;
  countdownTimer?: NodeJS.Timeout;
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
  if (playerCount >= 20) return 5;
  if (playerCount >= 5)  return 15;
  return 30;
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

  await triggerGameEvent(gameId, 'countdown-start', { seconds, playerCount });
  logger.info(`[Game ${gameId}] Countdown started: ${seconds}s for ${playerCount} players`);

  const timer = setTimeout(() => runGame(gameId), seconds * 1000);

  const existing = activeGames.get(gameId);
  if (existing) {
    existing.countdownTimer = timer;
  } else {
    activeGames.set(gameId, {
      gameId,
      roomType: 'CASUAL',
      drawnNumbers: [],
      numberPool: buildNumberPool(),
      countdownTimer: timer,
    });
  }
}

// ─── Run Game ─────────────────────────────────────────────────
async function runGame(gameId: string): Promise<void> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { room: true, tickets: true },
  });

  if (!game || game.status === GameStatus.CANCELLED) return;

  // Ensure 2+ players still in game
  if (game.tickets.length < 2) {
    await cancelGame(gameId, 'Not enough players when game started');
    return;
  }

  await prisma.game.update({
    where: { id: gameId },
    data: { status: GameStatus.RUNNING, startedAt: new Date() },
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
  logger.info(`[Game ${gameId}] Game RUNNING with ${game.tickets.length} players`);

  // Start draw loop
  state.drawInterval = setInterval(() => drawNumber(gameId), config.game.drawIntervalMs);
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
    const card = ticket.card as BingoCard;
    const result = checkWin(card, drawnNumbers);

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
  activeGames.delete(gameId);

  await prisma.game.update({
    where: { id: gameId },
    data: { status: GameStatus.CANCELLED, cancelledAt: new Date(), cancelReason: reason },
  });

  // Refund all ticket purchases
  const tickets = await prisma.ticket.findMany({ where: { gameId }, include: { user: true } });
  for (const ticket of tickets) {
    const game = await prisma.game.findUnique({ where: { id: gameId }, include: { room: true } });
    if (!game) continue;

    const refundAmount = game.room.ticketPrice;
    const wallet = await prisma.wallet.findUnique({ where: { userId: ticket.userId } });
    if (!wallet) continue;

    const after = new Decimal(wallet.balance).add(refundAmount);
    await prisma.wallet.update({
      where: { userId: ticket.userId },
      data: { balance: after, totalSpent: new Decimal(wallet.totalSpent).sub(refundAmount) },
    });

    await prisma.transaction.create({
      data: {
        userId: ticket.userId,
        type: 'REFUND',
        amount: refundAmount,
        balanceBefore: wallet.balance,
        balanceAfter: after,
        status: 'COMPLETED',
        referenceId: gameId,
        description: `Refund: cancelled game`,
      },
    });

    await triggerUserEvent(ticket.userId, 'game-cancelled', {
      gameId,
      refundAmount: refundAmount.toFixed(2),
      reason,
    });
  }

  await triggerGameEvent(gameId, 'game-cancelled', { gameId, reason });
  logger.info(`[Game ${gameId}] Cancelled: ${reason}`);
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

import { PREDEFINED_CARDS } from '../lib/predefinedCards';

// ... existing code ...

// ─── Join Game ────────────────────────────────────────────────
export async function joinGame(
  userId: string,
  gameId: string,
  cardId: number = 1 // Default to 1 if not provided
): Promise<{ ticket: any; card: BingoCard }> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { room: true, tickets: true },
  });

  if (!game) throw new Error('Game not found');
  if (game.status !== GameStatus.WAITING && game.status !== GameStatus.COUNTDOWN) {
    throw new Error('Game is not accepting players');
  }

  // Ensure cardId is valid 1-100
  const normalizedCardId = Math.max(1, Math.min(100, cardId));
  const cardPattern = PREDEFINED_CARDS[normalizedCardId];

  if (!cardPattern) throw new Error('Invalid card selection');

  // Convert predefined format [[...], [...]] to engine format { rows: [...] }
  const card: BingoCard = {
    rows: cardPattern.map(row => row.map(cell => cell === 0 ? 'FREE' : cell)) as any
  };

  // Enforce Hard Limit of 3 cards
  const existingTicketsCount = await prisma.ticket.count({
    where: { userId, gameId }
  });
  if (existingTicketsCount >= 3) throw new Error('Maximum of 3 cards allowed per player');

  // Check wallet balance
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error('Wallet not found');

  const ticketPrice = game.room.ticketPrice;
  if (new Decimal(wallet.balance).lessThan(ticketPrice)) {
    throw new Error(`Insufficient balance. Need ${ticketPrice}, have ${wallet.balance}`);
  }

  // Deduct balance
  const newBalance = new Decimal(wallet.balance).sub(ticketPrice);
  const houseEdge = new Decimal(ticketPrice).mul(config.game.houseEdgePercent).div(100);
  const prizeContribution = new Decimal(ticketPrice).sub(houseEdge);

  await prisma.$transaction([
    prisma.wallet.update({
      where: { userId },
      data: {
        balance: newBalance,
        totalSpent: new Decimal(wallet.totalSpent).add(ticketPrice),
      },
    }),
    prisma.game.update({
      where: { id: gameId },
      data: {
        totalPrize: new Decimal(game.totalPrize).add(prizeContribution),
        houseEdge: new Decimal(game.houseEdge).add(houseEdge),
        currentPlayers: { increment: 1 },
      } as any,
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: 'TICKET_PURCHASE',
        amount: ticketPrice,
        balanceBefore: wallet.balance,
        balanceAfter: newBalance,
        status: 'COMPLETED',
        referenceId: gameId,
        description: `Ticket for ${game.room.type} game`,
      },
    }),
  ]);

  const ticket = await prisma.ticket.create({
    data: { userId, gameId, card: card as any, markedNumbers: [] },
  });

  // Update room player count
  const updatedGame = await prisma.game.findUnique({
    where: { id: gameId },
    include: { tickets: true },
  });
  const playerCount = updatedGame?.tickets.length ?? 0;

  await triggerGameEvent(gameId, 'player-joined', { userId, playerCount });
  await triggerAdminEvent('player-joined', { gameId, userId, playerCount });

  // Auto-start countdown if enough players
  const minPlayers = game.room.minPlayers;
  if (playerCount >= minPlayers) {
    const currentState = activeGames.get(gameId);
    if (!currentState?.countdownTimer) {
      await startCountdown(gameId, playerCount);
    } else {
      // Update countdown if more players joined during countdown
      const state = activeGames.get(gameId);
      if (state) {
        const newCountdown = getCountdownSeconds(playerCount);
        const currentCountdown = (await prisma.game.findUnique({ where: { id: gameId } }))?.countdownSeconds ?? 30;
        if (newCountdown < currentCountdown) {
          clearTimeout(state.countdownTimer);
          state.countdownTimer = setTimeout(() => runGame(gameId), newCountdown * 1000);
          await prisma.game.update({ where: { id: gameId }, data: { countdownSeconds: newCountdown } });
          await triggerGameEvent(gameId, 'countdown-update', { seconds: newCountdown, playerCount });
        }
      }
    }
  }

  return { ticket, card };
}

export function getActiveGames(): Map<string, ActiveGame> {
  return activeGames;
}
