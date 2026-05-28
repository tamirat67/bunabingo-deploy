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
import { checkWin, BingoCard } from '../game/card.generator';
import { PREDEFINED_CARDS } from '../lib/predefinedCards';

// ─── Win Quota Config ─────────────────────────────────────────
// House bot must win 7 out of every 10 games (70% win rate)
const CYCLE_LENGTH = 10;
const HOUSE_WIN_QUOTA = 7;

// ─── Bot count per room type ──────────────────────────────────
export const BOT_COUNTS: Record<string, number> = {
  CASUAL:   30,
  STANDARD: 30,
  PRO:      30,
  VIP:      10,
  JACKPOT:  10,
};

// ─── In-memory set to prevent double-injecting bots ───────────
const gamesWithBotsInjected = new Set<string>();

/**
 * Check if the current cycle says the house should win this game.
 * Resets the cycle after every 5 games.
 */
export async function shouldHouseWinThisGame(roomType: string): Promise<boolean> {
  // Check process.env.FORCE_HOUSE_BOT_WIN
  if (process.env.FORCE_HOUSE_BOT_WIN === 'true') {
    logger.info(`[HouseBot] ${roomType} — FORCE_HOUSE_BOT_WIN is true → House Wins 100%`);
    return true;
  }
  if (process.env.FORCE_HOUSE_BOT_WIN === 'false') {
    logger.info(`[HouseBot] ${roomType} — FORCE_HOUSE_BOT_WIN is false → House wins 0%`);
    return false;
  }

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

  const gamesLeft = CYCLE_LENGTH - cycle.totalGames;
  const houseWinsLeft = HOUSE_WIN_QUOTA - cycle.houseWins;

  // Must win if remaining quota requires it
  if (houseWinsLeft >= gamesLeft) return true;
  // Must let player win if quota already reached
  if (houseWinsLeft <= 0) return false;

  // Otherwise, probabilistic decision
  const probability = houseWinsLeft / gamesLeft;
  const roll = Math.random();
  logger.info(`[HouseBot] ${roomType} — HouseWinProb: ${(probability * 100).toFixed(1)}%, Roll: ${(roll * 100).toFixed(1)}% → House Wins: ${roll < probability}`);
  return roll < probability;
}

/**
 * Record the result of a game into the cycle tracker.
 */
export async function recordCycleResult(roomType: string, houseWon: boolean): Promise<void> {
  try {
    await prisma.gameCycle.upsert({
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

  const botCount = BOT_COUNTS[roomType] ?? 30;
  const isVip = roomType === 'VIP' || roomType === 'JACKPOT';
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

  // Build a pool of available card IDs not yet taken
  const taken = new Set(alreadyTakenCardIds);
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
  maxAttempts = 500,
  minDrawn = 20  // minimum balls drawn before any win is valid
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

    // Simulate drawing numbers one by one
    let firstWinnerIsBot: boolean | null = null;
    let winAtBall = 0;

    for (let drawn = 1; drawn <= pool.length; drawn++) {
      const drawnSoFar = pool.slice(0, drawn);

      for (const ticket of tickets) {
        const cardData = ticket.card;
        const rows: BingoCard = Array.isArray(cardData)
          ? cardData
          : cardData?.rows ?? cardData;

        if (!rows) continue;

        const result = checkWin(rows, drawnSoFar);
        if (result.won) {
          firstWinnerIsBot = botUserSet.has(ticket.userId);
          winAtBall = drawn;
          break;
        }
      }

      if (firstWinnerIsBot !== null) break;
    }

    // Reject any sequence where a win occurs before minDrawn balls
    if (firstWinnerIsBot === null || winAtBall < minDrawn) continue;

    // Check if this sequence matches what we want
    if (houseShouldWin && firstWinnerIsBot === true) {
      // Perfect: house bot wins first in this sequence
      // Return as a reversed pool (draw with .pop() from end)
      logger.info(`[RiggedDraw] House win sequence found in ${attempt + 1} attempt(s) at ball #${winAtBall}`);
      return pool.reverse();
    }
    if (!houseShouldWin && firstWinnerIsBot === false) {
      // Perfect: real player wins first
      logger.info(`[RiggedDraw] Player win sequence found in ${attempt + 1} attempt(s) at ball #${winAtBall}`);
      return pool.reverse();
    }
    // Wrong outcome — try another shuffle
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
