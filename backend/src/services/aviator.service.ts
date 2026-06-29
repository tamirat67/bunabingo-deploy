/**
 * ═══════════════════════════════════════════════════════
 *  AVIATOR SERVICE  —  BunaBingoBot
 * ═══════════════════════════════════════════════════════
 *
 * Completely isolated from Bingo game logic.
 * Uses the same User + Wallet models but via its own
 * AviatorGame + AviatorBet models.
 *
 * Game cycle:
 *   WAITING  (5 s)  → COUNTDOWN  (5 s)  → FLYING → CRASHED  → repeat
 *
 * Crash multiplier: exponentially-weighted random
 *   P(crash at x) ∝ 1/x²   (house edge ≈ 4%)
 *   generateCrash() returns a Decimal ≥ 1.00
 */

import prisma from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '../lib/logger';
import { getIO } from '../lib/socket';
import { creditWallet, debitWallet } from './wallet.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AviatorPhase = 'WAITING' | 'COUNTDOWN' | 'FLYING' | 'CRASHED';

interface AviatorGameState {
  gameId: string | null;
  phase: AviatorPhase;
  multiplier: number;          // current live multiplier
  crashAt: number;             // pre-generated crash point
  startedAt: number | null;    // ms timestamp when FLYING began
  bets: Map<string, ActiveBet>;// userId → bet
}

interface ActiveBet {
  betId: string;
  userId: string;
  betAmount: number;
  targetMultiplier: number | null; // auto-cashout, null = manual
  cashedOut: boolean;
  cashoutMultiplier: number | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WAITING_SECONDS   = 5;
const COUNTDOWN_SECONDS = 5;
const TICK_MS           = 100;   // multiplier update interval
const HOUSE_EDGE        = 0.04;  // 4% house edge

// ── In-memory game state ──────────────────────────────────────────────────────

let gameState: AviatorGameState = {
  gameId:    null,
  phase:     'WAITING',
  multiplier: 1.00,
  crashAt:   2.00,
  startedAt: null,
  bets:      new Map(),
};

// ── Crash Multiplier Generator ────────────────────────────────────────────────
/**
 * Generates a crash multiplier using an inverse CDF of an
 * exponential distribution with house-edge trimming.
 *
 * Formula:  crashAt = max(1.00,  1 / (1 - U) * (1 - houseEdge))
 *   where U ~ Uniform(0, 1)
 *
 * This gives roughly:
 *   ~55% of rounds crash at or below 2×
 *   ~10% of rounds reach 10×
 *   ~1%  of rounds reach 100×
 */
function generateCrash(): number {
  const u = Math.random();
  // Avoid division by zero
  if (u >= 1 - HOUSE_EDGE) return 1.00;
  const rawMultiplier = (1 - HOUSE_EDGE) / (1 - u);
  // Floor to 2 decimal places
  return Math.max(1.00, Math.floor(rawMultiplier * 100) / 100);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function broadcast(event: string, data: any) {
  try {
    const io = getIO();
    io.to('aviator_room').emit(event, data);
  } catch (_) {
    // Socket not initialized yet during early startup — ignore
  }
}

function broadcastState() {
  broadcast('gameState', {
    GameState:        phaseToGameState(gameState.phase),
    currentNum:       parseFloat(gameState.multiplier.toFixed(2)),
    currentSecondNum: parseFloat(gameState.multiplier.toFixed(2)),
    time:             gameState.startedAt ? Date.now() - gameState.startedAt : 0,
  });
}

function phaseToGameState(phase: AviatorPhase): string {
  switch (phase) {
    case 'WAITING':   return 'WAIT';
    case 'COUNTDOWN': return 'BET';
    case 'FLYING':    return 'PLAY';
    case 'CRASHED':   return 'ENDED';
  }
}

async function resolveDbUserId(userId: string): Promise<string> {
  if (/^\d+$/.test(userId)) {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(userId) },
      select: { id: true },
    });
    if (!user) throw new Error('User not found');
    return user.id;
  }
  return userId;
}

// ── Game Loop ─────────────────────────────────────────────────────────────────

async function runWaiting() {
  gameState.phase      = 'WAITING';
  gameState.multiplier = 1.00;
  gameState.startedAt  = null;
  gameState.gameId     = null;
  broadcastState();

  await sleep(WAITING_SECONDS * 1000);
}

async function runCountdown() {
  // Clear previous round bets when new betting phase starts
  gameState.bets.clear();

  // Create DB record
  const game = await prisma.aviatorGame.create({
    data: { status: 'WAITING' },
  });
  gameState.gameId = game.id;
  gameState.phase  = 'COUNTDOWN';
  gameState.crashAt = generateCrash();

  logger.info(`[Aviator] New game ${game.id} | crashAt=${gameState.crashAt}`);
  broadcastState();
  broadcast('getBetLimits', { min: 5, max: 5000 });

  await sleep(COUNTDOWN_SECONDS * 1000);
}

async function runFlying() {
  if (!gameState.gameId) return;

  await prisma.aviatorGame.update({
    where: { id: gameState.gameId },
    data:  { status: 'RUNNING', startedAt: new Date() },
  });

  gameState.phase     = 'FLYING';
  gameState.multiplier = 1.00;
  gameState.startedAt  = Date.now();
  broadcastState();

  // Tick loop
  while (gameState.phase === 'FLYING') {
    await sleep(TICK_MS);

    const elapsed = (Date.now() - gameState.startedAt!) / 1000;
    // Growth: multiplier = e^(0.06 * seconds)  → gentle exponential curve
    gameState.multiplier = parseFloat(Math.exp(0.06 * elapsed).toFixed(2));

    // Auto-cashouts for this tick
    await processAutoCashouts();

    broadcastState();

    if (gameState.multiplier >= gameState.crashAt) {
      gameState.phase = 'CRASHED';
    }
  }
}

async function runCrash() {
  if (!gameState.gameId) return;

  gameState.multiplier = gameState.crashAt;

  // Mark all uncashed bets as LOST
  const lostUserIds: string[] = [];
  for (const [userId, bet] of gameState.bets.entries()) {
    if (!bet.cashedOut) {
      lostUserIds.push(userId);
      await prisma.aviatorBet.update({
        where: { id: bet.betId },
        data:  { status: 'LOST' },
      });
    }
  }

  await prisma.aviatorGame.update({
    where: { id: gameState.gameId },
    data:  {
      status:          'FINISHED',
      crashMultiplier: new Decimal(gameState.crashAt.toFixed(2)),
      finishedAt:      new Date(),
    },
  });

  // Calculate Company Profit for this round and deposit to Master Agent
  try {
    let totalBets = 0;
    let totalWins = 0;
    for (const bet of gameState.bets.values()) {
      totalBets += bet.betAmount;
      if (bet.cashedOut && bet.cashoutMultiplier) {
        totalWins += bet.betAmount * bet.cashoutMultiplier;
      }
    }
    const profit = totalBets - totalWins;

    // Find master agent Luel1616
    const masterAgent = await prisma.user.findFirst({
      where: {
        OR: [
          { username: "Luel1616" },
          { telegramUsername: "Luel1616" },
          { username: "@Luel1616" },
          { telegramUsername: "@Luel1616" }
        ]
      }
    });

    if (masterAgent) {
      await prisma.wallet.update({
        where: { userId: masterAgent.id },
        data: { aviatorBalance: { increment: profit } }
      });
      logger.info(`[Aviator] Deposited ${profit} ETB profit to Master Agent @Luel1616`);
    } else {
      logger.warn(`[Aviator] Master Agent @Luel1616 not found. Profit of ${profit} ETB was not deposited.`);
    }
  } catch (err: any) {
    logger.error(`[Aviator] Error depositing company profit: ${err.message}`);
  }

  // Build previous hand for history display
  const previousHand = Array.from(gameState.bets.values()).map(b => ({
    name:       b.userId,
    betAmount:  b.betAmount,
    cashOut:    b.cashoutMultiplier ?? gameState.crashAt,
    cashouted:  b.cashedOut,
    target:     b.targetMultiplier ?? 0,
    img:        '',
    bot:        false,
  }));

  broadcast('previousHand', previousHand);
  broadcast('gameState', {
    GameState:        'ENDED',
    currentNum:       parseFloat(gameState.crashAt.toFixed(2)),
    currentSecondNum: parseFloat(gameState.crashAt.toFixed(2)),
    time:             0,
  });

  logger.info(`[Aviator] Game ${gameState.gameId} CRASHED at ${gameState.crashAt}×. Lost: ${lostUserIds.length} players.`);

  await sleep(2500); // brief pause so UI can display crash
}

// ── Auto-cashout processing ───────────────────────────────────────────────────

async function processAutoCashouts() {
  for (const [, bet] of gameState.bets.entries()) {
    if (
      !bet.cashedOut &&
      bet.targetMultiplier !== null &&
      gameState.multiplier >= bet.targetMultiplier
    ) {
      await performCashout(bet, bet.targetMultiplier);
    }
  }
}

async function performCashout(bet: ActiveBet, at: number) {
  if (bet.cashedOut) return;
  bet.cashedOut         = true;
  bet.cashoutMultiplier = at;

  const winAmount = parseFloat((bet.betAmount * at).toFixed(2));

  try {
    const dbUserId = await resolveDbUserId(bet.userId);

    await prisma.aviatorBet.update({
      where: { id: bet.betId },
      data:  {
        cashoutMultiplier: new Decimal(at.toFixed(2)),
        winAmount:         new Decimal(winAmount.toFixed(2)),
        status:            'WON',
      },
    });

    await creditWallet(
      dbUserId,
      winAmount,
      'PRIZE_WIN',
      bet.betId,
      `Aviator cashout at ${at}×`
    );

    // Notify just this user about their updated balance
    try {
      const io = getIO();
      io.to(`aviator_user_${bet.userId}`).emit('success', `Cashed out at ${at}× — you won ${winAmount.toFixed(2)} ETB!`);
    } catch (_) {}

    logger.info(`[Aviator] Cashout userId=${bet.userId} at ${at}× | won=${winAmount}`);
  } catch (err: any) {
    logger.error(`[Aviator] Cashout failed for user ${bet.userId}: ${err.message}`);
  }
}

// ── Main game loop ────────────────────────────────────────────────────────────

async function gameLoop() {
  logger.info('[Aviator] Game loop started');
  while (true) {
    try {
      await runWaiting();
      await runCountdown();
      await runFlying();
      await runCrash();
    } catch (err: any) {
      logger.error('[Aviator] Game loop error:', err.message);
      await sleep(3000);
    }
  }
}

// ── Public API (called from socket handlers) ──────────────────────────────────

/**
 * Join the aviator socket room and send current state + user info
 */
export async function aviatorEnterRoom(socketId: string, userId: string, io: any) {
  const socket = io.sockets.sockets.get(socketId);
  if (!socket) return;

  socket.join('aviator_room');
  socket.join(`aviator_user_${userId}`);

  // Send current game state
  socket.emit('gameState', {
    GameState:        phaseToGameState(gameState.phase),
    currentNum:       parseFloat(gameState.multiplier.toFixed(2)),
    currentSecondNum: parseFloat(gameState.multiplier.toFixed(2)),
    time:             gameState.startedAt ? Date.now() - gameState.startedAt : 0,
  });

  socket.emit('getBetLimits', { min: 5, max: 5000 });

  // Send user wallet info
  try {
    const dbUserId = await resolveDbUserId(userId);
    const wallet = await prisma.wallet.findUnique({ where: { userId: dbUserId } });
    const user   = await prisma.user.findUnique({ where: { id: dbUserId }, select: { firstName: true, username: true, telegramUsername: true } });

    const balance = wallet ? parseFloat(new Decimal(wallet.balance.toString()).add(new Decimal(wallet.bonusBalance.toString())).toFixed(2)) : 0;
    const existingBet = gameState.bets.get(userId);

    socket.emit('myInfo', {
      balance,
      userType:  false,
      img:       '',
      userName:  user?.username ?? user?.telegramUsername ?? user?.firstName ?? userId,
      f: existingBet && !existingBet.cashedOut ? {
        auto: existingBet.targetMultiplier !== null,
        betted: true,
        cashouted: false,
        betAmount: existingBet.betAmount,
        cashAmount: 0,
        target: existingBet.targetMultiplier ?? 0,
      } : { auto: false, betted: false, cashouted: false, betAmount: 20, cashAmount: 0, target: 2 },
      s: { auto: false, betted: false, cashouted: false, betAmount: 20, cashAmount: 0, target: 2 },
    });

    socket.emit('myBetState', {
      balance,
      userType:  false,
      img:       '',
      userName:  user?.username ?? user?.telegramUsername ?? user?.firstName ?? userId,
      f: { auto: false, betted: existingBet && !existingBet.cashedOut, cashouted: false, betAmount: 20, cashAmount: 0, target: 2 },
      s: { auto: false, betted: false, cashouted: false, betAmount: 20, cashAmount: 0, target: 2 },
    });

    // Send recent bet history
    const recentBets = await prisma.aviatorBet.findMany({
      where:   { userId: dbUserId },
      orderBy: { createdAt: 'desc' },
      take:    20,
      include: { game: { select: { crashMultiplier: true } } },
    });

    socket.emit('history', recentBets.map(b => parseFloat((b.game?.crashMultiplier ?? new Decimal(1)).toString())));

    // Current betted users
    const bettedUsersArr = Array.from(gameState.bets.values()).map(b => ({
      name:      b.userId,
      betAmount: b.betAmount,
      cashOut:   b.cashoutMultiplier ?? 0,
      cashouted: b.cashedOut,
      target:    b.targetMultiplier ?? 0,
      img:       '',
    }));
    socket.emit('bettedUserInfo', bettedUsersArr);

  } catch (err: any) {
    logger.warn(`[Aviator] enterRoom failed for user ${userId}: ${err.message}`);
  }
}

/**
 * Place a bet for a user (called during COUNTDOWN / BET phase)
 */
export async function aviatorPlaceBet(
  userId: string,
  betAmount: number,
  target: number,
  type: 'f' | 's'
): Promise<{ success: boolean; error?: string; balance?: number }> {
  if (gameState.phase !== 'COUNTDOWN') {
    return { success: false, error: 'Bets are only accepted during the countdown phase' };
  }

  if (!gameState.gameId) {
    return { success: false, error: 'No active game' };
  }

  // Only one active bet per user (simplified: first bet only)
  if (type === 's') {
    return { success: false, error: 'Second bet slot coming soon' };
  }

  if (gameState.bets.has(userId)) {
    return { success: false, error: 'You already have an active bet' };
  }

  if (betAmount < 5 || betAmount > 5000) {
    return { success: false, error: 'Bet must be between 5 and 5,000 ETB' };
  }

  try {
    const dbUserId = await resolveDbUserId(userId);

    // Deduct from wallet BEFORE confirming bet
    await debitWallet(dbUserId, betAmount, 'TICKET_PURCHASE', gameState.gameId, 'Aviator bet');

    const bet = await prisma.aviatorBet.create({
      data: {
        gameId:          gameState.gameId,
        userId:          dbUserId,
        betAmount:       new Decimal(betAmount.toFixed(2)),
        targetMultiplier: target > 1 ? new Decimal(target.toFixed(2)) : null,
        status:          'PENDING',
      },
    });

    const activeBet: ActiveBet = {
      betId:             bet.id,
      userId,
      betAmount,
      targetMultiplier:  target > 1 ? target : null,
      cashedOut:         false,
      cashoutMultiplier: null,
    };
    gameState.bets.set(userId, activeBet);

    // Broadcast updated betted users to room
    const bettedUsersArr = Array.from(gameState.bets.values()).map(b => ({
      name:      b.userId,
      betAmount: b.betAmount,
      cashOut:   0,
      cashouted: false,
      target:    b.targetMultiplier ?? 0,
      img:       '',
    }));
    broadcast('bettedUserInfo', bettedUsersArr);

    logger.info(`[Aviator] Bet placed userId=${userId} amount=${betAmount} target=${target}`);
    
    // Fetch updated balance to return for real-time socket update
    const wallet = await prisma.wallet.findUnique({ where: { userId: dbUserId } });
    const newBalance = wallet ? parseFloat(new Decimal(wallet.balance.toString()).add(new Decimal(wallet.bonusBalance.toString())).toFixed(2)) : 0;
    
    return { success: true, balance: newBalance };
  } catch (err: any) {
    logger.error(`[Aviator] Bet failed for user ${userId}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Cash out a bet manually
 */
export async function aviatorCashOut(
  userId: string,
  at: number,
  index: 'f' | 's'
): Promise<{ success: boolean; error?: string; balance?: number }> {
  if (gameState.phase !== 'FLYING') {
    return { success: false, error: 'You can only cash out while the plane is flying' };
  }

  const bet = gameState.bets.get(userId);
  if (!bet || bet.cashedOut) {
    return { success: false, error: 'No active bet to cash out' };
  }

  const cashoutAt = parseFloat(gameState.multiplier.toFixed(2));
  await performCashout(bet, cashoutAt);
  
  // Fetch updated balance to return for real-time socket update
  try {
    const dbUserId = await resolveDbUserId(userId);
    const wallet = await prisma.wallet.findUnique({ where: { userId: dbUserId } });
    const newBalance = wallet ? parseFloat(new Decimal(wallet.balance.toString()).add(new Decimal(wallet.bonusBalance.toString())).toFixed(2)) : 0;
    return { success: true, balance: newBalance };
  } catch (e) {
    return { success: true };
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

export function startAviatorLoop() {
  gameLoop().catch(err => logger.error('[Aviator] Fatal loop error:', err));
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
