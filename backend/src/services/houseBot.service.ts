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
// Dynamic house bot win cycle logic (e.g. 9/10, 8/10, 5/10)
const CYCLE_LENGTH = 10;

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

  // ─── DYNAMIC CYCLE LOGIC ───
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
  // We use settings.bingoWinRate (0 to 10). If it's 9, house wins the first 9 games of the cycle.
  const quota = settings.bingoWinRate ?? 9;

  // If forceHouseWin is TRUE or quota is 10, house ALWAYS wins.
  if (settings.forceHouseWin || quota >= CYCLE_LENGTH) {
    logger.info(`[HouseBot] ${roomType} — Quota is ${quota}/10 or forceHouseWin is TRUE → House Wins 100%`);
    return true;
  }

  if (cycle.totalGames < quota) {
    logger.info(`[HouseBot] ${roomType} — Strict Quota Active: Game ${cycle.totalGames + 1}/10 (Quota ${quota}/10). Forcing House Win.`);
    return true;
  }

  // Games after the quota (e.g. game 10 if quota is 9, games 6-10 if quota is 5): real players can potentially win.
  logger.info(`[HouseBot] ${roomType} — Cycle Quota Met (Game ${cycle.totalGames + 1}/10). Real players are allowed to win.`);
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
function getWinPatterns(cardRows: any[][], targetWinMode: string): number[][] {
  const patterns: number[][] = [];
  
  const extractNumbers = (coords: [number, number][]) => {
    const nums: number[] = [];
    for (const [r, c] of coords) {
      const val = cardRows[r][c];
      if (val !== 'FREE' && val !== 0 && val !== null) {
        nums.push(Number(val));
      }
    }
    return nums;
  };

  if (targetWinMode === 'ROW') {
    for (let r = 0; r < 5; r++) {
      patterns.push(extractNumbers([[r, 0], [r, 1], [r, 2], [r, 3], [r, 4]]));
    }
  } else if (targetWinMode === 'COLUMN') {
    for (let c = 0; c < 5; c++) {
      patterns.push(extractNumbers([[0, c], [1, c], [2, c], [3, c], [4, c]]));
    }
  } else if (targetWinMode === 'DIAGONAL') {
    patterns.push(extractNumbers([[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]]));
    patterns.push(extractNumbers([[0, 4], [1, 3], [2, 2], [3, 1], [4, 0]]));
  } else if (targetWinMode === 'FOUR_CORNERS') {
    patterns.push(extractNumbers([[0, 0], [0, 4], [4, 0], [4, 4]]));
  } else if (targetWinMode === 'FULL_HOUSE') {
    const coords: [number, number][] = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) coords.push([r, c]);
    }
    patterns.push(extractNumbers(coords));
  }

  return patterns;
}

function shuffleArray(arr: any[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function generateRandomSequence(): number[] {
  const pool = Array.from({ length: 75 }, (_, i) => i + 1);
  shuffleArray(pool);
  return pool.reverse(); // Engine pops from the end
}

export function buildDeterministicSequence(
  tickets: { userId: string; card: any; isBot?: boolean }[],
  houseShouldWin: boolean,
  minDrawn = 20,
  targetWinMode: string = 'ROW'
): number[] {
  if (!houseShouldWin) {
    logger.info(`[RiggedDraw] Player win requested. Using random sequence.`);
    return generateRandomSequence();
  }

  const botTickets = tickets.filter(t => t.isBot);
  const realPlayerCards = tickets
    .filter(t => !t.isBot)
    .map(t => parseCardRows(t.card))
    .filter(rows => rows !== null) as any[][][];

  shuffleArray(botTickets);

  const allModes = [targetWinMode, 'ROW', 'COLUMN', 'DIAGONAL', 'FOUR_CORNERS'];
  const triedModes = new Set<string>();

  for (const mode of allModes) {
    if (triedModes.has(mode)) continue;
    triedModes.add(mode);

    for (const bot of botTickets) {
      const botRows = parseCardRows(bot.card);
      if (!botRows) continue;

      const patterns = getWinPatterns(botRows, mode);
      shuffleArray(patterns); 

      for (const pattern of patterns) {
        const triggerCandidates = [...pattern];
        shuffleArray(triggerCandidates);

        for (const trigger of triggerCandidates) {
          const preWinNumbers = pattern.filter(n => n !== trigger);
          
          const currentDrawn = new Set<number>();
          let impossible = false;
          
          for (const num of [...preWinNumbers, trigger]) {
            if (currentDrawn.has(num)) continue;
            currentDrawn.add(num);
            let safe = true;
            const drawnArray = Array.from(currentDrawn);
            for (const rows of realPlayerCards) {
              if (checkWin(rows as any, drawnArray).won) {
                safe = false; break;
              }
            }
            if (!safe) { impossible = true; break; }
          }
          if (impossible) continue; 

          const fillersPool = Array.from({ length: 75 }, (_, i) => i + 1).filter(n => !pattern.includes(n));
          shuffleArray(fillersPool);

          const safeFillers: number[] = [];
          
          const isNumSafeForEveryone = (num: number, drawnSet: Set<number>) => {
            if (drawnSet.has(num)) return true;
            drawnSet.add(num);
            let safe = true;
            const drawnArray = Array.from(drawnSet);
            
            for (const rows of realPlayerCards) {
              if (checkWin(rows as any, drawnArray).won) {
                safe = false; break;
              }
            }
            if (safe) {
              if (checkWin(botRows as any, drawnArray).won) {
                safe = false; 
              }
            }
            
            drawnSet.delete(num);
            return safe;
          };

          for (const filler of fillersPool) {
            if (isNumSafeForEveryone(filler, currentDrawn)) {
              safeFillers.push(filler);
              currentDrawn.add(filler);
            }
          }

          const targetPreWinCount = Math.max(0, minDrawn - 1);
          const neededFillers = Math.max(0, targetPreWinCount - preWinNumbers.length);
          const selectedFillers = safeFillers.slice(0, neededFillers);
          
          const preTriggerSequence = [...preWinNumbers, ...selectedFillers];
          shuffleArray(preTriggerSequence);
          
          const sequenceToWin = [...preTriggerSequence, trigger];
          
          const remainingBalls = Array.from({ length: 75 }, (_, i) => i + 1)
            .filter(n => !sequenceToWin.includes(n));
          shuffleArray(remainingBalls);
          
          const finalSequence = [...sequenceToWin, ...remainingBalls];
          
          logger.info(`[RiggedDraw] ✅ Built deterministic sequence for bot using mode ${mode}. Trigger: ${trigger}, total to win: ${sequenceToWin.length}`);
          
          return finalSequence.reverse();
        }
      }
    }
  }

  logger.warn(`[RiggedDraw] ❌ Failed to build deterministic sequence. Falling back to random.`);
  return generateRandomSequence();
}
