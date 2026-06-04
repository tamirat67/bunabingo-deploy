import prisma, { withRetry } from '../lib/prisma';
import { logger } from '../lib/logger';
import { config } from '../config';
import { triggerGameEvent, triggerUserEvent, triggerAdminEvent } from '../lib/pusher';
import { generateBingoCard, checkWin, parseCardRows, BingoCard } from './card.generator';
import { Decimal } from '@prisma/client/runtime/library';
import { RoomType, GameStatus } from '@prisma/client';
import { PREDEFINED_CARDS } from '../lib/predefinedCards';
import { awardCoins, XP_REWARDS, REFERRAL_COMMISSION_PERCENT, creditReferralCommission } from '../services/wallet.service';
import { contributeToJackpot, checkJackpotWin } from '../services/jackpot.service';
import { debitAgentCommissionForGame } from '../services/agentPreDeposit.service';
import {
  injectBotTickets,
  shouldHouseWinThisGame,
  rigDrawSequence,
  clearBotInjectionRecord,
  creditBunaWallet,
  debitBunaWallet,
  recordCycleResult,
  BOT_COUNTS,
} from '../services/houseBot.service';

interface ActiveGame {
  gameId: string;
  roomType: RoomType;
  drawnNumbers: number[];
  drawInterval?: NodeJS.Timeout;
  countdownTimer?: NodeJS.Timeout;
  countdownInterval?: NodeJS.Timeout;
  secondsRemaining?: number;
  countdownStartedAt?: number;   // epoch ms when this countdown began (for mid-join sync)
  numberPool: number[];
  tickets?: any[];
  ticketCount?: number;
  houseShouldWin?: boolean;  // rigged draw: true = house bot wins this round
  targetWinMode?: string;    // the specific pattern the house bot is trying to win with
  countdownTargetTime?: number; // Fixed, exact epoch ms when countdown reaches 0
  pendingBotClaim?: boolean; // true when a bot claim is in-flight — prevents pool-exhaustion fallback
}

const activeGames = new Map<string, ActiveGame>();

// Tracks which games have already had bots injected (engine-level guard)
const gamesWithBotsInjectedPublic = new Set<string>();

// Tracks games currently being finished to prevent double-finish race conditions
const gamesBeingFinished = new Set<string>();

// Tracks waiting timeouts for WAITING games
const waitingTimers = new Map<string, NodeJS.Timeout>();

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
function getCountdownSeconds(playerCount: number, roomType: string): number {
  const cdConfig = config.game.countdown as Record<string, number>;
  if (roomType in cdConfig) {
    return cdConfig[roomType];
  }
  return cdConfig.default ?? 30;
}

// ─── Start Countdown ──────────────────────────────────────────
export async function startCountdown(gameId: string, playerCount: number): Promise<void> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      room: true,
      tickets: { include: { user: { select: { isBot: true } } } },
    },
  });
  if (!game) return;

  // STRICT SINGLETON ENFORCEMENT: Never start a game if another is active in this room
  if (game.room.type !== 'DEMO') {
    const activeOverlap = await prisma.game.findFirst({
      where: { 
        roomId: game.roomId, 
        status: { in: ['RUNNING', 'COUNTDOWN'] },
        id: { not: gameId }
      }
    });
    
    if (activeOverlap) {
      logger.info(`[Engine] Game ${gameId} countdown blocked because game ${activeOverlap.id} is currently ${activeOverlap.status}. Staying WAITING.`);
      return;
    }
  }

  // Clear any active waiting timeout for this game
  const waitingTimer = waitingTimers.get(gameId);
  if (waitingTimer) {
    clearTimeout(waitingTimer);
    waitingTimers.delete(gameId);
    logger.info(`[Engine] Cleared waiting timeout for game ${gameId} because countdown started.`);
  }

  const seconds = getCountdownSeconds(playerCount, game.room.type);

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
      roomType: game.room.type as any,
      drawnNumbers: [],
      numberPool: buildNumberPool(),
      secondsRemaining: seconds,
      ticketCount: playerCount,
    };
    activeGames.set(gameId, existing);
  } else {
    existing.ticketCount = playerCount;
  }

  existing.secondsRemaining = seconds;

  if (seconds <= 0) {
    logger.info(`[Game ${gameId}] Countdown is ${seconds}s. Starting game loop immediately.`);
    if (existing.countdownInterval) clearInterval(existing.countdownInterval);
    if (existing.countdownTimer) clearTimeout(existing.countdownTimer);
    runGame(gameId);
    return;
  }
  const fixedEndTime = Date.now() + seconds * 1000;
  existing.countdownTargetTime = fixedEndTime;
  
  await triggerGameEvent(gameId, 'countdown-start', { seconds, playerCount, endTime: fixedEndTime, serverTime: Date.now() });
  logger.info(`[Game ${gameId}] Countdown started: ${seconds}s for ${playerCount} players`);

  // Clear any existing timer/interval
  if (existing.countdownInterval) clearInterval(existing.countdownInterval);
  if (existing.countdownTimer) clearTimeout(existing.countdownTimer);

  // Record exact moment this countdown began (used by socket join-game sync)
  existing.countdownStartedAt = Date.now();

  // Set up the tick interval
  existing.countdownInterval = setInterval(async () => {
    if (existing!.secondsRemaining! > 0) {
      existing!.secondsRemaining!--;
      
      // Get current ticket count from in-memory cache, falling back to db COUNT if undefined
      let currentTicketCount = existing!.ticketCount;
      if (currentTicketCount === undefined) {
        currentTicketCount = await prisma.ticket.count({ where: { gameId } });
        existing!.ticketCount = currentTicketCount;
      }

      logger.info(`[Game ${gameId}] Countdown tick: ${existing!.secondsRemaining}s, Players: ${currentTicketCount}`);

      await triggerGameEvent(gameId, 'countdown-tick', { 
        secondsRemaining: existing!.secondsRemaining,
        playerCount: currentTicketCount,
        endTime: existing!.countdownTargetTime, // Always send the exact, non-drifting end time
        serverTime: Date.now()
      });

      // Immediate transition when countdown hits 0s, avoiding the 1-second lag!
      if (existing!.secondsRemaining === 0) {
        if (existing!.countdownInterval) {
          clearInterval(existing!.countdownInterval);
          existing!.countdownInterval = undefined;
        }
        runGame(gameId);
      }
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

  const isDemo = game.room.type === 'DEMO';
  const ticketCount = game.tickets.length;

  // ─── Special Handling for SPIN rooms (Raffle Draw) ──────────────────────────
  if (game.room.type.startsWith('SPIN_')) {
     await runSpinRaffle(gameId);
     return;
  }

  let realPlayerCount = 0;

  // ─── Player count validation (skip for DEMO) ─────────────────────────────
  if (!isDemo) {
    // Count real (non-bot) players separately
    const ticketsWithUsers = await prisma.ticket.findMany({
      where: { gameId },
      select: { userId: true, user: { select: { isBot: true } } }
    });
    realPlayerCount = new Set(
      ticketsWithUsers.filter(t => !t.user.isBot).map(t => t.userId)
    ).size;
  }

  // ─── CHARGE PLAYERS NOW (skip entirely for DEMO — no real money) ────────────
  const unitPrice = game.room.ticketPrice;
  const houseEdgePercent = config.game.houseEdgePercent;
  let totalPrizePool = new Decimal(0);
  let totalHouseEdge = new Decimal(0);

  if (!isDemo && realPlayerCount < 1) {
    logger.info(`[Game ${gameId}] Loop Guard: 0 real players found. Restarting 20s countdown to wait for real players.`);
    await startCountdown(gameId, ticketCount);
    return;
  }

  const ticketsByUser = new Map<string, typeof game.tickets>();
  for (const ticket of game.tickets) {
    const existing = ticketsByUser.get(ticket.userId) || [];
    existing.push(ticket);
    ticketsByUser.set(ticket.userId, existing);
  }

  if (!isDemo) {
    // Fetch all user isBot flags to avoid checking or charging bots
    const userIds = Array.from(ticketsByUser.keys());
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, isBot: true }
    });
    const botUserMap = new Map<string, boolean>();
    for (const u of users) {
      botUserMap.set(u.id, u.isBot);
    }

    // ─── CHARGE PLAYERS (real game only) ───────────────────────────────────
    for (const [userId, userTickets] of ticketsByUser) {
      const numTickets = userTickets.length;
      const totalCharge = new Decimal(unitPrice).mul(numTickets);
      const houseEdge = totalCharge.mul(houseEdgePercent).div(100);
      const prizeContribution = totalCharge.sub(houseEdge);

      // Skip charging house bots, but STILL ADD their simulated contribution to the prize pool
      if (botUserMap.get(userId) === true) {
        logger.debug(`[Game ${gameId}] User ${userId} is a house bot — skipping balance check but adding simulated prize`);
        totalPrizePool = totalPrizePool.add(prizeContribution);
        totalHouseEdge = totalHouseEdge.add(houseEdge);
        continue;
      }

      const wallet = await prisma.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        logger.error(`[Game ${gameId}] Wallet not found for user ${userId} — skipping charge`);
        continue;
      }

      const balance = new Decimal(wallet.balance.toString());
      const bonus = new Decimal(wallet.bonusBalance.toString());
      const totalAvailable = balance.add(bonus);

      if (totalAvailable.lessThan(totalCharge)) {
        logger.warn(`[Game ${gameId}] User ${userId} has insufficient balance at game start — removing tickets`);
        await prisma.ticket.deleteMany({ where: { gameId, userId } });
        continue;
      }

      // Deduct from Bonus Wallet first, then Main Wallet
      let remainingToDebit = totalCharge;
      let newBonus = bonus;
      let newBalance = balance;

      if (bonus.greaterThan(0)) {
        const bonusToUse = Decimal.min(bonus, remainingToDebit);
        newBonus = bonus.sub(bonusToUse);
        remainingToDebit = remainingToDebit.sub(bonusToUse);
      }

      if (remainingToDebit.greaterThan(0)) {
        newBalance = balance.sub(remainingToDebit);
      }

      await prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { userId },
          data: {
            balance: newBalance,
            bonusBalance: newBonus,
            totalSpent: new Decimal(wallet.totalSpent.toString()).add(totalCharge),
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
            description: `Game started — ${numTickets} ticket(s) charged for ${game.room.type} (Bonus Used: ${bonus.sub(newBonus).toFixed(2)} ETB)`,
          },
        });
      });

      totalPrizePool = totalPrizePool.add(prizeContribution);
      totalHouseEdge = totalHouseEdge.add(houseEdge);
      logger.info(`[Game ${gameId}] Charged ${totalCharge} ETB from user ${userId} (${numTickets} ticket(s))`);

      try {
        await awardCoins(userId, XP_REWARDS.JOIN_GAME * numTickets, `Joined game ${gameId} with ${numTickets} card(s)`);
      } catch (e) { logger.warn(`[Coins] Failed to award join XP to ${userId}:`, e); }

      const userObj = await prisma.user.findUnique({ where: { id: userId }, select: { referredBy: true, firstName: true } });
      if (userObj?.referredBy) {
        const commission = totalCharge.mul(REFERRAL_COMMISSION_PERCENT).div(100);
        if (commission.greaterThan(0)) {
          try {
            await creditReferralCommission(
              userObj.referredBy,
              commission,
              `Commission from ${userObj.firstName}'s tickets in ${game.room.type}`,
              userId
            );
            totalHouseEdge = totalHouseEdge.sub(commission);
          } catch (e) {
            logger.error(`[Referral] Failed to credit commission to referrer of ${userId}:`, e);
          }
        }
      }
    }

    // ─── Agent Commission (real game only) ──────────────────────────────────
    const totalSales = totalPrizePool.add(totalHouseEdge);
    if (!game.isPublic) {
      try {
        await debitAgentCommissionForGame(gameId, totalSales);
      } catch (commissionErr: any) {
        logger.error(`[Game ${gameId}] Commission debit FAILED — cancelling game:`, commissionErr);
        for (const [userId, userTickets] of ticketsByUser) {
        // Skip house bots during refunds
        if (botUserMap.get(userId) === true) continue;

        const numTickets = userTickets.length;
        const totalCharge = new Decimal(unitPrice).mul(numTickets);
        await prisma.wallet.update({ where: { userId }, data: { balance: { increment: totalCharge }, totalSpent: { decrement: totalCharge } } });
        await prisma.transaction.create({
          data: {
            userId, type: 'REFUND', amount: totalCharge,
            balanceBefore: new Decimal(0), balanceAfter: new Decimal(0), status: 'COMPLETED',
            referenceId: gameId, description: `Refund: game cancelled — insufficient agent commission balance`,
          },
        });
        await triggerUserEvent(userId, 'game-cancelled', { gameId, reason: 'Agent commission balance insufficient. Game cancelled and refunded.' });
      }
      await prisma.game.update({ where: { id: gameId }, data: { status: GameStatus.CANCELLED, cancelledAt: new Date(), cancelReason: commissionErr.message } });
      await triggerGameEvent(gameId, 'game-cancelled', { gameId, reason: commissionErr.message });
      return;
    }
    } else {
      logger.info(`[Game ${gameId}] Public Game — agent commission skipped (goes directly to platform)`);
    }

    // Note: Jackpot contribution is now handled in real-time live upon user ticket purchase inside joinGame()
  } else {
    logger.info(`[Game ${gameId}] DEMO game — skipping all financial logic.`);
  }

  // ─── Mark game as RUNNING (both real and DEMO) ────────────────────────────
  // Prize pool = 70% of REAL PLAYER stakes ONLY (bot stakes are synthetic, not real cash)
  // House commission = 30% of REAL PLAYER stakes (20% company + 10% agent) — from pre-deposit
  // Bot stakes are visual only: they inflate player count but do NOT add real cash to prize pool
  let displayPrizePool: Decimal;
  let displayHouseEdge: Decimal;
  const GUARANTEED_PRIZES: Record<string, number> = { CASUAL: 50, STANDARD: 100, PRO: 250, JACKPOT: 500, VIP: 1000 };
  
  if (isDemo) {
    displayPrizePool = new Decimal(100);
    displayHouseEdge = new Decimal(0);
  } else {
    const totalRealStake = new Decimal(unitPrice).mul(realPlayerCount);
    
    // Commission is 30% of REAL player stakes only (from agent pre-deposit).
    displayHouseEdge = totalRealStake.mul(houseEdgePercent).div(100);
    
    // Calculate the real player contribution (70% of their stake)
    const realPlayerContribution = totalRealStake.sub(displayHouseEdge);
    
    // The prize pool is guaranteed to be at least the minimum for this room type.
    // If there are many real players, it scales up naturally.
    const roomTypeName = game.room.type;
    const minPrize = GUARANTEED_PRIZES[roomTypeName] || 50;
    
    displayPrizePool = Decimal.max(new Decimal(minPrize), realPlayerContribution);
    
    logger.info(`[Game ${gameId}] Real Player Stake (${realPlayerCount} cards × ${unitPrice} ETB) = ${totalRealStake} ETB | Commission (${houseEdgePercent}%) = ${displayHouseEdge} ETB | Guaranteed Prize Pool = ${displayPrizePool} ETB`);
  }

  await prisma.game.update({
    where: { id: gameId },
    data: {
      status: GameStatus.RUNNING,
      startedAt: new Date(),
      totalPrize: displayPrizePool,
      houseEdge: displayHouseEdge,
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

  await triggerGameEvent(gameId, 'game-started', { gameId, playerCount: game.tickets.length, prizePool: displayPrizePool.toFixed(2), serverTime: Date.now() });
  logger.info(`[Game ${gameId}] Game RUNNING with ${ticketCount} tickets (real + bots). Prize pool: ${displayPrizePool} ETB (75% of all stakes)`);

  // ─── Load tickets + Rig Draw Sequence (House Bot System) ────────────────────
  // Fetch all tickets including the isBot flag from the joined user
  const ticketsWithBotFlag = await prisma.ticket.findMany({
    where: { gameId },
    include: { user: { select: { isBot: true } } },
  });
  state.tickets = ticketsWithBotFlag;

  // Only rig non-DEMO, non-SPIN rooms that have bots
  const hasBotPlayers = ticketsWithBotFlag.some(t => t.user?.isBot);
  if (!isDemo && hasBotPlayers) {
    const houseShouldWin = await shouldHouseWinThisGame(game.room.type);
    state.houseShouldWin = houseShouldWin;

    // Map tickets for the rig simulator
    const ticketsForSim = ticketsWithBotFlag.map(t => ({
      userId: t.userId,
      card: t.card,
      isBot: t.user?.isBot ?? false,
    }));

    logger.info(`[RiggedDraw] Game ${gameId} (${game.room.type}) — House should win: ${houseShouldWin}`);

    // Pick a target win mode that rotates per game using gameId hash
    // This ensures each game has a DIFFERENT winning pattern
    const WIN_MODE_ROTATION = ['ROW', 'COLUMN', 'DIAGONAL', 'FOUR_CORNERS', 'ROW', 'COLUMN', 'DIAGONAL', 'FOUR_CORNERS'];
    let modeHash = 0;
    for (let i = 0; i < gameId.length; i++) {
      modeHash = gameId.charCodeAt(i) + ((modeHash << 5) - modeHash);
    }
    const targetWinMode = WIN_MODE_ROTATION[Math.abs(modeHash) % WIN_MODE_ROTATION.length];
    logger.info(`[RiggedDraw] Target win mode for game ${gameId}: ${targetWinMode}`);

    const riggedPool = rigDrawSequence(ticketsForSim, houseShouldWin, 3000, config.game.minBallsBeforeWin, targetWinMode);
    state.numberPool = riggedPool; // override the random pool with the rigged one
    state.targetWinMode = targetWinMode; // save it so checkAllTickets can prioritize it
  }

  // Start draw loop
  if (state.drawInterval) clearInterval(state.drawInterval);
  state.drawInterval = setInterval(() => drawNumber(gameId), config.game.drawIntervalMs);
  
  // NOTE: We intentionally DO NOT call drawNumber(gameId) immediately here anymore.
  // Waiting for the first interval (3s) gives the frontend time to play the "start.mp3"
  // audio without the first ball's audio overlapping it!
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

  const uniqueUsers = new Set(game.tickets.map(t => t.userId));
  if (!game || game.tickets.length < game.room.minPlayers || uniqueUsers.size < 2) {
    logger.info(`[Spin ${gameId}] 0 players found. Restarting 20s countdown to wait for players.`);
    await startCountdown(gameId, game.tickets.length);
    return;
  }

  // ─── Phase 1: Debit Players (Missing in original logic!) ───────────────
  const ticketsByUser = new Map<string, any[]>();
  game.tickets.forEach(t => {
    const list = ticketsByUser.get(t.userId) || [];
    list.push(t);
    ticketsByUser.set(t.userId, list);
  });

  const unitPrice = game.room.ticketPrice;
  const houseEdgePercent = config.game.houseEdgePercent;
  let totalPrizePool = new Decimal(0);
  let totalHouseEdge = new Decimal(0);

  for (const [userId, userTickets] of ticketsByUser) {
    const numTickets = userTickets.length;
    const totalCharge = new Decimal(unitPrice).mul(numTickets);
    const houseEdge = totalCharge.mul(houseEdgePercent).div(100);
    const prizeContribution = totalCharge.sub(houseEdge);

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) continue;

    const balance = new Decimal(wallet.balance.toString());
    const bonus = new Decimal(wallet.bonusBalance.toString());
    const totalAvailable = balance.add(bonus);

    if (totalAvailable.lessThan(totalCharge)) {
      logger.warn(`[Spin ${gameId}] User ${userId} has insufficient balance. Skipping.`);
      continue;
    }

    // Deduct from Bonus Wallet first, then Main Wallet
    let remainingToDebit = totalCharge;
    let newBonus = bonus;
    let newBalance = balance;

    if (bonus.greaterThan(0)) {
      const bonusToUse = Decimal.min(bonus, remainingToDebit);
      newBonus = bonus.sub(bonusToUse);
      remainingToDebit = remainingToDebit.sub(bonusToUse);
    }

    if (remainingToDebit.greaterThan(0)) {
      newBalance = balance.sub(remainingToDebit);
    }

    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { userId },
        data: { 
          balance: newBalance,
          bonusBalance: newBonus,
          totalSpent: { increment: totalCharge }
        }
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
          description: `Spin Tournament Join: ${game.room.type} (Game #${gameId}) (Bonus Used: ${bonus.sub(newBonus).toFixed(2)} ETB)`
        }
      });
    });

    totalPrizePool = totalPrizePool.add(prizeContribution);
    totalHouseEdge = totalHouseEdge.add(houseEdge);
    logger.info(`[Spin ${gameId}] Charged ${totalCharge} ETB from user ${userId}`);
  }

  // Update game prize with actual collected amounts
  await prisma.game.update({
    where: { id: gameId },
    data: {
      totalPrize: totalPrizePool,
      houseEdge: totalHouseEdge,
      status: GameStatus.RUNNING,
      startedAt: new Date(),
    }
  });

  // ─── Phase 2: Run Raffle ──────────────────────────────────────────────

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
    // If a bot claim is already in-flight, don't double-trigger end-of-pool logic
    if (state.pendingBotClaim) {
      logger.info(`[Game ${gameId}] Pool exhausted but bot claim is pending — waiting for claim to resolve.`);
      return;
    }

    if (state.tickets && state.tickets.length > 0) {
      // Force a winner if all numbers are drawn and no one claimed. Prefer house bots.
      const botTickets = state.tickets.filter(t => t.user?.isBot === true);
      const poolToPickFrom = botTickets.length > 0 ? botTickets : state.tickets;
      const randomTicket = poolToPickFrom[Math.floor(Math.random() * poolToPickFrom.length)];

      // Detect the actual winning mode rather than always forcing FULL_HOUSE
      const rows = parseCardRows(randomTicket.card);
      let actualWinMode: string = 'FULL_HOUSE';
      if (rows) {
        const winResult = checkWin(rows as BingoCard, state.drawnNumbers);
        if (winResult.won && winResult.modes.length > 0) {
          // Pick the most impressive mode the ticket actually has
          const modePriority = ['FULL_HOUSE', 'FOUR_CORNERS', 'DIAGONAL', 'COLUMN', 'ROW'];
          for (const m of modePriority) {
            if (winResult.modes.includes(m as any)) { actualWinMode = m; break; }
          }
        }
      }

      logger.warn(`[Game ${gameId}] All 75 numbers drawn — forcing winner (bot pool: ${botTickets.length}/${state.tickets.length} tickets). Picking ticket ${randomTicket.id} with mode ${actualWinMode}`);
      try {
        await processWinner(gameId, randomTicket.userId, randomTicket.id, actualWinMode, state.drawnNumbers);
      } catch (e: any) {
        // Ignore duplicate winner errors (may already have been recorded)
        if (!e?.message?.includes('Unique') && !e?.message?.includes('unique')) {
          logger.error(`[Game ${gameId}] Force-winner processWinner failed:`, e);
        }
      }
      await finishGame(gameId, `Auto-selected winner at end of game: ${actualWinMode}`);
    } else {
      // No tickets at all — this should not happen in normal operation
      logger.error(`[Game ${gameId}] All 75 numbers drawn but state.tickets is empty! Finishing with no winner.`);
      await finishGame(gameId, 'All numbers drawn - no tickets sold');
    }
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

  // Check all tickets for winners (Now only updates markedNumbers in DB, doesn't auto-claim)
  await checkAllTickets(gameId, state.drawnNumbers);
}

// This is now purely in-memory and very fast
async function checkAllTickets(gameId: string, drawnNumbers: number[]): Promise<void> {
  const state = activeGames.get(gameId);
  if (!state || !state.tickets) return;

  for (const ticket of state.tickets) {
    const rows = parseCardRows(ticket.card);
    if (!rows) {
      logger.warn(`[Game ${gameId}] Skipping ticket ${ticket.id} due to card parsing failure.`);
      continue;
    }
    
    const result = checkWin(rows as BingoCard, drawnNumbers);
    if (result.won) {
        logger.debug(`[Game ${gameId}] Ticket ${ticket.id} HAS ${result.modes.join(', ')}.`);
        
        // Guard: don't allow any win before minimum balls drawn
        if (drawnNumbers.length < config.game.minBallsBeforeWin) {
          logger.info(`[Game ${gameId}] Win detected too early (ball #${drawnNumbers.length}/${config.game.minBallsBeforeWin} min) — skipping`);
          continue;
        }
        
        // Auto-claim for house bots
        if (ticket.user?.isBot === true) {
           // Clear draw interval immediately to pause drawings (simulates thinking/clicking claim)
           if (state?.drawInterval) {
             clearInterval(state.drawInterval);
             state.drawInterval = undefined;
           }
           
           // Mark that a bot claim is in-flight so pool-exhaustion fallback doesn't fire
           if (state) state.pendingBotClaim = true;

           // Capture the winning mode NOW (before the timeout) so it can't change
           // If the bot won with multiple patterns (e.g., ROW and COLUMN at the same time),
           // we MUST prioritize the game's target win mode so the variety is actually displayed!
           let capturedWinMode = result.modes[0];
           if (state?.targetWinMode && result.modes.includes(state.targetWinMode as any)) {
             capturedWinMode = state.targetWinMode as any;
           }

           const delayMs = 1000 + Math.floor(Math.random() * 500); // 1.0s to 1.5s delay
           logger.info(`[Game ${gameId}] BOT WINNER DETECTED! Scheduling human-like auto-claim in ${delayMs}ms for ${capturedWinMode}...`);
           
           setTimeout(async () => {
             // Check if game is still running (e.g. hasn't been finished/cancelled by a faster human claim)
             const gameCheck = await prisma.game.findUnique({ where: { id: gameId } });
             const currentState = activeGames.get(gameId);
             
             if (!gameCheck || gameCheck.status === GameStatus.FINISHED || gameCheck.status === GameStatus.CANCELLED) {
               // Game is already done — another winner claimed first. That's fine.
               logger.info(`[Game ${gameId}] Bot claim skipped — game already ${gameCheck?.status ?? 'GONE'}`);
               if (currentState) currentState.pendingBotClaim = false;
               return;
             }

             if (gameCheck.status !== GameStatus.RUNNING) {
               // Game is in an unexpected state (WAITING, COUNTDOWN?) — resume draw to unfreeze
               logger.warn(`[Game ${gameId}] Bot claim cancelled — unexpected status ${gameCheck.status}. Resuming draw interval.`);
               if (currentState) {
                 currentState.pendingBotClaim = false;
                 if (!currentState.drawInterval) {
                   currentState.drawInterval = setInterval(() => drawNumber(gameId), config.game.drawIntervalMs);
                 }
               }
               return;
             }

             try {
               // Must get latest drawn numbers as they could have updated before the timeout
               const latestState = activeGames.get(gameId);
               const finalDrawn = latestState ? latestState.drawnNumbers : drawnNumbers;
               await processWinner(gameId, ticket.userId, ticket.id, capturedWinMode, finalDrawn);
               await finishGame(gameId, `House Bot Bingo claimed: ${capturedWinMode}`);
             } catch (err: any) {
               logger.error(`[Game ${gameId}] Bot auto-claim failed:`, err);
               // If bot claim fails, we MUST resume the draw interval so the game doesn't freeze
               if (currentState) {
                 currentState.pendingBotClaim = false;
                 if (!currentState.drawInterval) {
                   const recheckGame = await prisma.game.findUnique({ where: { id: gameId }, select: { status: true } });
                   if (recheckGame?.status === 'RUNNING') {
                     currentState.drawInterval = setInterval(() => drawNumber(gameId), config.game.drawIntervalMs);
                     logger.info(`[Game ${gameId}] Resumed interval after bot claim failure.`);
                   }
                 }
               }
             }
           }, delayMs);
           
           // We found a winning bot! Immediately stop checking other tickets for this draw cycle
           // so that the first winning bot gets the claim process initiated.
           return; 
        }
    }
  }
}

// ─── Claim Bingo Win (Optimized) ─────────────────────────────────
export async function claimBingoWin(gameId: string, userId: string): Promise<{ won: boolean; mode?: string; prize?: number; error?: string }> {
  // Immediately pause the draw interval in memory to stop calling new balls
  const state = activeGames.get(gameId);
  const oldInterval = state?.drawInterval;
  if (state?.drawInterval) {
    clearInterval(state.drawInterval);
    state.drawInterval = undefined;
    logger.info(`[Game ${gameId}] Claim initiated by user ${userId}. Paused ball drawing.`);
  }

  try {
    // Use a targeted query to get game and user tickets in one go if possible, or just optimize the game fetch
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { 
        drawHistory: { select: { number: true } }, 
        room: { select: { ticketPrice: true } },
        winners: { select: { winMode: true } }
      }
    });

    if (!game || game.status !== 'RUNNING') {
      return { won: false, error: 'Game is not running or already finished' };
    }

    // Guard: minimum balls must be drawn before any real player can claim
    const drawnCount = await prisma.drawHistory.count({ where: { gameId } });
    if (drawnCount < config.game.minBallsBeforeWin) {
      return { won: false, error: `Game just started — wait for more balls! (${drawnCount}/${config.game.minBallsBeforeWin} minimum)` };
    }

    const tickets = await prisma.ticket.findMany({
      where: { gameId, userId },
      select: { id: true, card: true }
    });

    const drawnNumbers = game.drawHistory.map(d => d.number);
    const existingWinModes = new Set(game.winners.map(w => w.winMode));

    let eligibleClaim: { ticketId: string, mode: any } | null = null;
    const priority = ['FULL_HOUSE', 'FOUR_CORNERS', 'DIAGONAL', 'COLUMN', 'ROW'] as const;

    for (const ticket of tickets) {
      const rows = parseCardRows(ticket.card);
      if (!rows) {
        logger.warn(`Skipping user ticket ${ticket.id} due to card parsing failure.`);
        continue;
      }
      const result = checkWin(rows, drawnNumbers);

      if (result.won) {
        for (const mode of priority) {
          if (result.modes.includes(mode as any) && !existingWinModes.has(mode as any)) {
            eligibleClaim = { ticketId: ticket.id, mode: mode as any };
            break;
          }
        }
      }
      if (eligibleClaim) break;
    }

    if (eligibleClaim) {
      const { mode, ticketId } = eligibleClaim;
      
      try {
        // Process everything fast!
        await processWinner(gameId, userId, ticketId, mode, drawnNumbers);
        
        // Finalize game
        await finishGame(gameId, `Bingo claimed: ${mode}`);
        
        const prizeAmount = new Decimal(game.totalPrize);
        return { won: true, mode, prize: Number(prizeAmount) };
      } catch (err: any) {
        if (err.message === 'WINNER_ALREADY_EXISTS') {
          return { won: false, error: 'Someone else already won this game! Better luck next time.' };
        }
        throw err;
      }
    }

    return { 
      won: false, 
      error: 'No valid Bingo detected yet! Check your patterns or wait for more balls.' 
    };

  } finally {
    // ALWAYS attempt to resume the draw loop if the game wasn't successfully finished
    if (state && !state.drawInterval && oldInterval) {
      // Check the DB to see if the game is actually still running
      const gameCheck = await prisma.game.findUnique({ where: { id: gameId }, select: { status: true } });
      if (gameCheck?.status === 'RUNNING' && !state.drawInterval) {
        state.drawInterval = setInterval(() => drawNumber(gameId), config.game.drawIntervalMs);
        logger.info(`[Game ${gameId}] Restored draw interval from finally block.`);
      }
    }
  }
}

async function calculatePrize(game: any, winMode: string): Promise<Decimal> {
  // Now that the game ends after the first claim, the winner gets the entire prize pool
  return new Decimal(game.totalPrize);
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
    include: { room: true },
  });
  if (!game) return;

  const isDemo = game.room.type === 'DEMO';
  const prizeAmount = new Decimal(game.totalPrize);

  // ─── Check if the winner is a House Bot ────────────────────────────────────
  const winnerUser = await prisma.user.findUnique({ where: { id: userId }, select: { isBot: true } });
  const isHouseBot = winnerUser?.isBot === true;

  // ─── Perform all winner logic in ONE TRANSACTION ───
  await prisma.$transaction(async (tx) => {
    // 0. RACE CONDITION GUARD: ensure NO winners exist for this game yet
    const existingWinner = await tx.winner.findFirst({ where: { gameId } });
    if (existingWinner) {
      throw new Error('WINNER_ALREADY_EXISTS');
    }

    // 1. Create winner record (always)
    await tx.winner.create({
      data: { gameId, userId, ticketId, winMode, prizeAmount },
    });

    // 2. Update player wallet (REAL games only, NEVER for bots)
    if (!isDemo && !isHouseBot) {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (wallet) {
        const before = wallet.balance;
        const after = new Decimal(wallet.balance).add(prizeAmount);

        await tx.wallet.update({
          where: { userId },
          data: {
            balance: after,
            totalWon: new Decimal(wallet.totalWon).add(prizeAmount),
          },
        });

        await tx.transaction.create({
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
    }

    // 3. Mark ticket as winner
    await tx.ticket.update({ where: { id: ticketId }, data: { isWinner: true } });

    // 4. Award XP (Only for real player wins)
    if (!isDemo && !isHouseBot) {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      const xpKey = `WIN_${winMode}` as keyof typeof XP_REWARDS;
      const xpAmount = XP_REWARDS[xpKey] ?? XP_REWARDS.WIN_ROW;
      if (wallet) {
         await tx.wallet.update({
           where: { userId },
           data: { coins: { increment: xpAmount } }
         });
      }
    }
  });

  // ─── Update System Reserve (Guaranteed Prize System) ─────────────────────
  if (!isDemo) {
    // 1. Calculate Real Player Contribution (70% of real stakes)
    const realTicketsCount = await prisma.ticket.count({ where: { gameId, user: { isBot: false } } });
    const realContribution = new Decimal(game.room.ticketPrice).mul(realTicketsCount).mul(0.70);
    
    // 2. Always credit real contributions to the Reserve Wallet first
    if (realContribution.greaterThan(0)) {
       await creditBunaWallet(realContribution, `Real stakes contribution from Game: ${gameId} (${game.room.type})`);
    }
    
    // 3. Process the payout logic against the reserve
    if (!isHouseBot) {
       // Real player won: The Guaranteed Prize is paid OUT of the reserve
       await debitBunaWallet(prizeAmount, `Guaranteed payout to real player [${winMode}] Game: ${gameId}`);
       await recordCycleResult(game.room.type, false);
       logger.info(`[SystemWallet] Deducted guaranteed prize of ${prizeAmount} ETB for Game ${gameId}`);
    } else {
       // House bot won: The prize stays in the reserve (already credited above), just record cycle
       await recordCycleResult(game.room.type, true);
       logger.info(`[SystemWallet] House bot won Game ${gameId} — Reserve grew by ${realContribution} ETB`);
    }
  }

  // ─── Notifications (Outside Transaction - Async) ───
  try {
    // Only check jackpot for real players
    if (!isHouseBot) {
      const jackpotWin = await checkJackpotWin(userId, ticketId, winMode, drawnNumbers.length);
      if (jackpotWin) {
        logger.info(`🔥 JACKPOT! User ${userId} won ${jackpotWin} ETB!`);
        triggerUserEvent(userId, 'jackpot-alert', { amount: jackpotWin.toFixed(2) });
      }
    }
  } catch (e) { 
    logger.error(`[Jackpot] Win check failed:`, e); 
  }

  // Broadcast winner — for bots, announce a generic-looking winner name so
  // real players see a result but don't notice it's a bot.
  triggerGameEvent(gameId, 'winner-announced', {
    userId: isHouseBot ? 'hidden' : userId,
    winMode,
    prizeAmount: prizeAmount.toFixed(2),
    drawnNumbers,
    isHouseBot,
  });

  if (!isHouseBot) {
    triggerUserEvent(userId, 'prize-received', {
      gameId,
      winMode,
      amount: prizeAmount.toFixed(2),
    });
  }

  logger.info(`[Game ${gameId}] Winner: user ${userId} (bot=${isHouseBot}) — ${winMode} — Prize: ${prizeAmount}`);
}

// ─── Finish Game ──────────────────────────────────────────────
async function finishGame(gameId: string, reason: string): Promise<void> {
  // Guard: prevent double-finishing the same game (race condition between bot claim + end-of-pool)
  if (gamesBeingFinished.has(gameId)) {
    logger.warn(`[Game ${gameId}] finishGame called twice — ignoring duplicate call. Reason: ${reason}`);
    return;
  }
  gamesBeingFinished.add(gameId);

  const state = activeGames.get(gameId);
  if (state?.drawInterval) clearInterval(state.drawInterval);
  if (state?.countdownTimer) clearTimeout(state.countdownTimer);
  if (state?.countdownInterval) clearInterval(state.countdownInterval);
  activeGames.delete(gameId);

  // Clear bot injection memory for this game
  clearBotInjectionRecord(gameId);
  gamesWithBotsInjectedPublic.delete(gameId);

  let updatedGame: any;
  try {
    updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.FINISHED, finishedAt: new Date() },
    });
  } catch (e: any) {
    // Game may have already been finished by another path — fetch it instead
    logger.warn(`[Game ${gameId}] Could not mark FINISHED (may already be): ${e.message}`);
    updatedGame = await prisma.game.findUnique({ where: { id: gameId } });
    if (!updatedGame) { gamesBeingFinished.delete(gameId); return; }
  }

  // gameTotalPrize is the source-of-truth prize pool stored on the game record
  const gameTotalPrize = parseFloat((updatedGame as any).totalPrize?.toString() ?? '0');

  // Fetch game totalPrize separately (updatedGame may not include it if select was used)
  const gameRecord = await prisma.game.findUnique({ where: { id: gameId }, select: { totalPrize: true } });
  const safeTotalPrize = parseFloat(gameRecord?.totalPrize?.toString() ?? '0') || gameTotalPrize;

  const winners = await prisma.winner.findMany({
    where: { gameId },
    include: { 
      user: { select: { firstName: true, telegramUsername: true, isBot: true, telegramId: true } },
      ticket: { select: { card: true } }
    },
  });

  // ─── LAST RESORT: If no winner was recorded but we have tickets, force one NOW ──
  // This is a safety net that catches any edge case where processWinner was skipped.
  if (winners.length === 0 && state?.tickets && state.tickets.length > 0) {
    logger.error(`[Game ${gameId}] finishGame called with NO winners! Forcing a winner from ${state.tickets.length} tickets.`);
    const botTickets = state.tickets.filter((t: any) => t.user?.isBot === true);
    const poolToPickFrom = botTickets.length > 0 ? botTickets : state.tickets;
    const randomTicket = poolToPickFrom[Math.floor(Math.random() * poolToPickFrom.length)];

    // Detect actual win mode from the ticket rather than forcing FULL_HOUSE
    const lastResortDrawn = state.drawnNumbers || [];
    const lastResortRows = parseCardRows(randomTicket.card);
    let lastResortMode: string = 'FULL_HOUSE';
    if (lastResortRows) {
      const winRes = checkWin(lastResortRows as BingoCard, lastResortDrawn);
      if (winRes.won && winRes.modes.length > 0) {
        const modePriority = ['FULL_HOUSE', 'FOUR_CORNERS', 'DIAGONAL', 'COLUMN', 'ROW'];
        for (const m of modePriority) {
          if (winRes.modes.includes(m as any)) { lastResortMode = m; break; }
        }
      }
    }
    logger.info(`[Game ${gameId}] Last-resort winner forced with mode: ${lastResortMode}`);

    try {
      await processWinner(gameId, randomTicket.userId, randomTicket.id, lastResortMode, lastResortDrawn);
      // Re-fetch winners after forcing one
      const newWinners = await prisma.winner.findMany({
        where: { gameId },
        include: {
          user: { select: { firstName: true, telegramUsername: true, isBot: true, telegramId: true } },
          ticket: { select: { card: true } }
        },
      });
      winners.push(...newWinners);
      logger.info(`[Game ${gameId}] Last-resort winner forced: ${randomTicket.userId}`);
    } catch (e: any) {
      logger.error(`[Game ${gameId}] Last-resort winner creation ALSO failed:`, e);
    }
  }

  // Disguise bot winners as real players for public broadcast so they get announced on frontend
  // Expanded name pool — no repeated names, varied per game using gameId + ticketId as entropy source
  const ETHIOPIAN_NAMES = [
    'Abebe', 'Kebede', 'Selam', 'Tesfaye', 'Dawit', 'Yonas', 'Tigist', 'Almaz',
    'Meron', 'Hiwot', 'Tizita', 'Biruk', 'Nahom', 'Eyob', 'Liya', 'Saron',
    'Kalkidan', 'Robel', 'Bethel', 'Henok', 'Rahel', 'Tsion', 'Abel', 'Eden',
  ];

  // Build a quick lookup of in-memory ticket cards (as fallback if DB ticket relation is null)
  const memTicketCardMap = new Map<string, any>();
  if (state?.tickets) {
    for (const t of state.tickets) {
      memTicketCardMap.set(t.id, t.card);
    }
  }

  const publicWinners = winners.map((w, idx) => {
    // Prisma returns Decimal objects — use .toString() for reliable conversion
    const winnerPrize = parseFloat(w.prizeAmount?.toString() ?? '0');
    // Fall back to game-level totalPrize if winner record has 0 (race condition)
    const resolvedPrize = winnerPrize > 0 ? winnerPrize : safeTotalPrize;

    // Aggressively resolve and parse the card
    let resolvedCard: any = w.ticket?.card ?? memTicketCardMap.get(w.ticketId) ?? null;
    
    if (typeof resolvedCard === 'string') {
      try { resolvedCard = JSON.parse(resolvedCard); } catch(e) {}
    }
    if (typeof resolvedCard === 'string') {
      try { resolvedCard = JSON.parse(resolvedCard); } catch(e) {}
    }

    let cardId: number | undefined = undefined;
    let cardRows: any[] | null = null;

    if (resolvedCard) {
      if (Array.isArray(resolvedCard)) {
        cardRows = resolvedCard;
      } else if (typeof resolvedCard === 'object') {
        cardId = resolvedCard.id;
        cardRows = resolvedCard.rows;
      }
    }

    // Last resort: reconstruct card rows from PREDEFINED_CARDS if we have no rows
    if (!cardRows || cardRows.length === 0) {
      // If we don't have a cardId, generate a deterministic pseudo-random one from ticketId 
      // so ALL devices and page refreshes see the exact same card and winning pattern.
      let safeCardId = cardId;
      if (!safeCardId) {
        const str = String(w.ticketId);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        safeCardId = Math.abs(hash % 250) + 1;
      }
      const pattern = PREDEFINED_CARDS[safeCardId];
      if (pattern) {
        cardRows = pattern.map((row: number[]) =>
          row.map((cell: number) => (cell === 0 ? 'FREE' : cell))
        );
        cardId = safeCardId;
      }
    }

    // Ensure the final card payload is a clean object
    const finalCard = { id: cardId, rows: cardRows };

    const isBot = w.user?.isBot ?? false;
    // For bots: pick a name using both gameId + ticketId for maximum per-game variety
    const realName = w.user?.firstName || w.user?.telegramUsername;
    let nameHash = 0;
    const nameSeed = gameId + String(w.ticketId);
    for (let i = 0; i < nameSeed.length; i++) {
      nameHash = nameSeed.charCodeAt(i) + ((nameHash << 5) - nameHash);
    }
    const botName = ETHIOPIAN_NAMES[Math.abs(nameHash) % ETHIOPIAN_NAMES.length];
    const displayName = isBot ? botName : (realName || 'Player');

    return {
      id: w.id,
      gameId: w.gameId,
      userId: w.userId,
      telegramId: w.user?.telegramId ? w.user.telegramId.toString() : null, // for frontend matching
      ticketId: w.ticketId,
      winMode: w.winMode,   // always the actual stored win mode
      prizeAmount: resolvedPrize,
      gamePrize: safeTotalPrize,
      card: finalCard,
      cardId: cardId || finalCard.id,
      isBot,                // real flag — frontend uses this for display logic
      user: {
        firstName: displayName,
        telegramUsername: isBot
          ? displayName.toLowerCase()
          : (w.user?.telegramUsername || displayName.toLowerCase()),
        isBot,
      }
    };
  });

  await triggerGameEvent(gameId, 'game-finished', { 
    gameId, 
    reason, 
    winners: publicWinners, 
    gamePrize: safeTotalPrize,
    drawnNumbers: state?.drawnNumbers || []
  });
  await triggerAdminEvent('game-finished', { gameId, reason });
  logger.info(`[Game ${gameId}] Finished: ${reason}`);

  // Clean up the double-finish guard
  gamesBeingFinished.delete(gameId);

  // Auto-create new waiting game for the same room so it's ready immediately.
  // If a real player joins → bots are injected and countdown starts.
  // If nobody joins within 2.5 minutes → the waitingTimer fires, injects bots and force-starts.
  await createWaitingGame(updatedGame.roomId);
}

const createWaitingGameLocks = new Map<string, Promise<string>>();

// ─── Create Waiting Game ──────────────────────────────────────
export async function createWaitingGame(roomId: string): Promise<string> {
  if (createWaitingGameLocks.has(roomId)) {
    return createWaitingGameLocks.get(roomId)!;
  }

  const promise = (async () => {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new Error('Room not found');

    // Check if there's already a waiting game for this room (SKIP THIS FOR DEMO so it's private)
    if (room.type !== 'DEMO') {
      const existing = await prisma.game.findFirst({
        where: { roomId, status: { in: ['WAITING', 'COUNTDOWN'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        // If the game was stuck in WAITING (e.g. because a previous game was running), start it now!
        if (existing.status === 'WAITING') {
          const fullCount = await prisma.ticket.count({ where: { gameId: existing.id } });
          await startCountdown(existing.id, fullCount);
        }
        return existing.id;
      }
    }
    
    const newGame = await prisma.game.create({
      data: {
        roomId,
        status: GameStatus.WAITING,
        totalPrize: 0,
      },
    });

    // ── Immediately start countdown (zero WAITING time) ──
    setImmediate(async () => {
      try {
        let fullCount = 0;
        
        // Try to inject bots if enabled and applicable
        if (room.type !== 'DEMO') {
          const { getHouseBotEnabled } = await import('../services/settings.service');
          const botEnabled = await getHouseBotEnabled();
          const isBotRoom = newGame.id && room.type in BOT_COUNTS;

          if (botEnabled && isBotRoom) {
            logger.info(`[Engine] Auto-injecting bots into new game ${newGame.id} (${room.type}).`);
            await injectBotTickets(newGame.id, room.type, []);
            fullCount = await prisma.ticket.count({ where: { gameId: newGame.id } });
            gamesWithBotsInjectedPublic.add(newGame.id);

            await Promise.all([
              triggerGameEvent(newGame.id, 'player-joined', {
                userId: 'bots',
                playerCount: fullCount,
                numTickets: fullCount,
                serverTime: Date.now(),
              }),
              triggerGameEvent(room.id, 'player-count-update', { playerCount: fullCount }),
            ]);
          }
        }

        // ALWAYS start the countdown immediately, even if no bots were injected
        await startCountdown(newGame.id, fullCount);
        
      } catch (e) {
        logger.error(`[Engine] Auto-start failed for game ${newGame.id}:`, e);
      }
    });

    return newGame.id;
  })();

  createWaitingGameLocks.set(roomId, promise);
  try {
    return await promise;
  } finally {
    createWaitingGameLocks.delete(roomId);
  }
}

// ─── Cancel Game ──────────────────────────────────────────────
export async function cancelGame(gameId: string, reason: string): Promise<void> {
  const state = activeGames.get(gameId);
  if (state?.drawInterval) clearInterval(state.drawInterval);
  if (state?.countdownTimer) clearTimeout(state.countdownTimer);
  if (state?.countdownInterval) clearInterval(state.countdownInterval);
  activeGames.delete(gameId);

  // Clear any active waiting timeout for this game
  const waitingTimer = waitingTimers.get(gameId);
  if (waitingTimer) {
    clearTimeout(waitingTimer);
    waitingTimers.delete(gameId);
  }

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


// ─── Join Game ────────────────────────────────────────────────
export async function joinGame(
  userId: string,
  gameId: string,
  cardIds: number[] = [1] // Default to card 1 if not provided
): Promise<{ tickets: any[]; cards: BingoCard[] }> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { room: true },
  });

  if (!game) throw new Error('Game not found');
  if (game.status !== GameStatus.WAITING && game.status !== GameStatus.COUNTDOWN) {
    const err: any = new Error('Game is not accepting players');
    err.code = 'GAME_IN_PROGRESS';
    err.roomId = game.roomId;
    throw err;
  }

  const numTickets = cardIds.length;
  if (numTickets === 0) throw new Error('No cards selected');
  if (numTickets > 5) throw new Error('Maximum of 5 cards allowed per player');
  
  const uniqueCardIds = new Set(cardIds);
  if (uniqueCardIds.size !== numTickets) {
    throw new Error('Duplicate card selection is not allowed!');
  }
  
  // Validate and prepare cards
  const preparedCards: { id: number, pattern: BingoCard }[] = [];
  for (const cardId of cardIds) {
    const isVipRoom = game.room.type === 'VIP' || game.room.type === 'JACKPOT' || Number(game.room.ticketPrice) >= 100;
    if (isVipRoom && (cardId < 1 || cardId > 50)) {
      throw new Error('VIP room only allows cards from 1 to 50!');
    }
    const normalizedId = Math.max(1, Math.min(250, cardId));
    const pattern = PREDEFINED_CARDS[normalizedId];
    if (!pattern) throw new Error(`Invalid card selection: ${cardId}`);
    
    preparedCards.push({
      id: normalizedId,
      pattern: pattern.map(row => row.map(cell => cell === 0 ? 'FREE' : cell)) as any
    });
  }

  // ── Balance check only — do NOT deduct here ─────────────────────────────────
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error('Wallet not found');

  const unitPrice = game.room.ticketPrice;
  const totalPrice = new Decimal(unitPrice).mul(numTickets);

  const balance = new Decimal(wallet.balance.toString());
  const bonus = new Decimal(wallet.bonusBalance.toString());
  const totalAvailable = balance.add(bonus);

  if (totalAvailable.lessThan(totalPrice)) {
    const currentTotal = Number(totalAvailable);
    if (currentTotal === 0) {
      throw new Error(`❌ Your wallet is empty (0 ETB). Please deposit via Telebirr to join the game!`);
    } else {
      throw new Error(`❌ Insufficient balance. You need ${totalPrice} ETB for ${numTickets} card(s), but you have ${currentTotal} ETB (Main: ${balance.toFixed(2)} ETB, Bonus: ${bonus.toFixed(2)} ETB).`);
    }
  }

  // ─── Perform everything in a SINGLE transaction for speed and atomicity with retry mechanism ───
  const { tickets, allTickets, playerCount, totalPrize, currentTicketCount, existingCount } = await withRetry(async () => {
    return prisma.$transaction(async (tx) => {
      // 1. Count user's existing tickets before deletion to calculate net change for live jackpot addition
      const existingCount = await tx.ticket.count({ where: { userId, gameId } });

      // 2. Acquire a write-lock on the Game row to serialize concurrent ticket purchases for this game
      await tx.game.update({
        where: { id: gameId },
        data: { status: game.status }
      });

      // 3. Check duplicate card selections inside the locked transaction
      const occupiedTickets = await tx.ticket.findMany({
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

      // 4. Clear existing tickets for this user in this game
      await tx.ticket.deleteMany({ where: { userId, gameId } });

      // 5. Create NEW Tickets inside a single Bulk INSERT query for maximum latency optimization!
      await tx.ticket.createMany({
        data: preparedCards.map(c => ({
          userId,
          gameId,
          card: { id: c.id, rows: c.pattern } as any,
          markedNumbers: []
        }))
      });

      // 6. Fetch all tickets for this game in a single query
      const allTickets = await tx.ticket.findMany({ where: { gameId } });
      const uniqueUsers = new Set(allTickets.map(t => t.userId));
      const pCount = uniqueUsers.size;
      const tCount = allTickets.length;

      // 7. Calculate & Update prize pool (Bots contribute 100% to prize, real players contribute 70%)
      const houseEdgePercent = config.game.houseEdgePercent;
      
      // Fetch all users to separate bots from real players
      const users = await tx.user.findMany({
        where: { id: { in: Array.from(uniqueUsers) } },
        select: { id: true, isBot: true }
      });
      const botUserIds = new Set(users.filter(u => u.isBot).map(u => u.id));
      
      const realTicketCount = allTickets.filter(t => !botUserIds.has(t.userId)).length;
      
      const totalStakeAll = new Decimal(unitPrice).mul(tCount);
      const totalRealStake = new Decimal(unitPrice).mul(realTicketCount);
      const houseEdge = totalRealStake.mul(houseEdgePercent).div(100);
      const prizePool = totalStakeAll.sub(houseEdge);

      await tx.game.update({
        where: { id: gameId },
        data: { 
          totalPrize: prizePool,
          houseEdge: houseEdge
        }
      });

      const userCreatedTickets = allTickets.filter(t => t.userId === userId);

      return { 
        tickets: userCreatedTickets, 
        allTickets,
        playerCount: pCount, 
        totalPrize: prizePool,
        currentTicketCount: tCount,
        existingCount
      };
    });
  });

  // ─── Return to client IMMEDIATELY after DB transaction ───────────────────
  // All broadcasts and bot injection run in the background so the client
  // navigates to the game page without waiting for socket events.
  const result = { 
    tickets, 
    cards: preparedCards.map(c => c.pattern) 
  } as any;

  // ─── All post-processing is fire-and-forget (non-blocking) ───────────────
  setImmediate(async () => {
    try {
      const isDemo = game.room.type === 'DEMO';
      // ─── Update in-memory state ─────────────────────────────────────────
      const currentState = activeGames.get(gameId);
      if (currentState) {
        currentState.ticketCount = currentTicketCount;
      }

      // ─── Max Wait Time Timeout Trigger ──────────────────────────────────
      if (game.status === GameStatus.WAITING && !isDemo && !waitingTimers.has(gameId)) {
        const maxWaitTimeMs = 150 * 1000; // 2.5 minutes
        const timer = setTimeout(async () => {
          waitingTimers.delete(gameId);
          try {
            const checkGame = await prisma.game.findUnique({
              where: { id: gameId },
              include: { room: true, tickets: { include: { user: true } } }
            });
            if (checkGame && checkGame.status === GameStatus.WAITING) {
              // Don't force-start if there are ZERO real players — bot-only games are pointless
              const realPlayerTickets = checkGame.tickets.filter(t => !t.user?.isBot);
              if (realPlayerTickets.length === 0) {
                logger.info(`[Engine] Game ${gameId} (${checkGame.room.type}) max wait reached but NO real players — skipping force-start. Waiting for a real player...`);
                return;
              }

              logger.info(`[Engine] Game ${gameId} (${checkGame.room.type}) reached max wait time with ${realPlayerTickets.length} real player(s). Force-starting countdown...`);
              const playerCount = checkGame.tickets.length;
              
              // Try bot injection if enabled
              const { getHouseBotEnabled } = await import('../services/settings.service');
              const botEnabled = await getHouseBotEnabled();
              const isBotRoom = checkGame.room.type in BOT_COUNTS;
              if (botEnabled && isBotRoom) {
                const hasBots = checkGame.tickets.some(t => t.user?.isBot);
                if (!hasBots) {
                  const takenCardIds = checkGame.tickets.map(t => (t.card as any).id as number);
                  await injectBotTickets(gameId, checkGame.room.type, takenCardIds);
                  const fullCount = await prisma.ticket.count({ where: { gameId } });
                  const botCount = BOT_COUNTS[checkGame.room.type] ?? 30;
                  
                  await Promise.all([
                    triggerGameEvent(gameId, 'player-joined', {
                      userId: 'bots',
                      playerCount: fullCount,
                      numTickets: botCount,
                      totalPrize: checkGame.totalPrize.toString(),
                      serverTime: Date.now(),
                    }),
                    triggerGameEvent(checkGame.roomId, 'player-count-update', { playerCount: fullCount }),
                  ]);
                  await startCountdown(gameId, fullCount);
                  return;
                }
              }
              await startCountdown(gameId, playerCount);
            }
          } catch (err) {
            logger.error(`[Engine] Failed to force-start game ${gameId}:`, err);
          }
        }, maxWaitTimeMs);
        waitingTimers.set(gameId, timer);
        logger.info(`[Engine] Scheduled 2.5-minute max wait timeout for game ${gameId}`);
      }

      // ─── Invalidate active room cache ───────────────────────────────────
      try {
        const { clearActiveRoomCache } = await import('./room.manager');
        clearActiveRoomCache(game.room.type);
      } catch (e) {
        logger.warn('Failed to clear active room cache:', e);
      }

      // ─── Live Jackpot contribution (background) ─────────────────────────
      const netTickets = numTickets - existingCount;
      if (!isDemo && netTickets > 0) {
        (async () => {
          try {
            const jackpot = await prisma.jackpot.findUnique({ where: { id: 'GLOBAL' } });
            if (jackpot) {
              const contribution = new Decimal(unitPrice).mul(netTickets).mul(jackpot.contributionPercent).div(100);
              const updatedJackpot = await prisma.jackpot.update({
                where: { id: 'GLOBAL' },
                data: { currentAmount: { increment: contribution } }
              });
              if (updatedJackpot) {
                await triggerAdminEvent('jackpot-updated', {
                  amount: updatedJackpot.currentAmount.toString(),
                  target: updatedJackpot.targetAmount.toString()
                });
                logger.info(`[Jackpot] Live Auto-Increment. New amount: ${updatedJackpot.currentAmount}`);
              }
            }
          } catch (e) {
            logger.error(`[Jackpot] Failed to update live jackpot:`, e);
          }
        })();
      }

      // ─── Socket Broadcasts ───────────────────────────────────────────────
      const endTime = currentState?.secondsRemaining ? (Date.now() + currentState.secondsRemaining * 1000) : undefined;
      const ticketData = allTickets.map(t => ({
        cardId: (t.card as any).id,
        userId: t.userId
      }));

      // Run all broadcasts in parallel for maximum speed
      await Promise.all([
        triggerGameEvent(gameId, 'occupied-sync', { tickets: ticketData, playerCount, gameId }),
        triggerGameEvent(game.room.type, 'occupied-sync', { tickets: ticketData, playerCount, gameId }),
        triggerGameEvent(gameId, 'player-joined', { 
          userId, 
          playerCount, 
          numTickets,
          totalPrize: totalPrize.toString(),
          secondsRemaining: currentState?.secondsRemaining,
          endTime,
          serverTime: Date.now()
        }),
        triggerUserEvent(userId, 'join-success', { gameId, numTickets }),
        triggerGameEvent(game.roomId, 'player-count-update', { playerCount }),
        triggerAdminEvent('player-joined', {
          gameId,
          userId,
          room: game.room.type,
          totalTickets: numTickets,
          pool: totalPrize.toString()
        }),
      ]);

      // ─── House Bot Injection + Auto-Start ───────────────────────────────
      const { getHouseBotEnabled } = await import('../services/settings.service');
      const houseBotEnabled = await getHouseBotEnabled();
      const isBotRoom = game.room.type in BOT_COUNTS;

      if (game.status === GameStatus.WAITING && isDemo) {
        await startCountdown(gameId, currentTicketCount);

      } else if (game.status === GameStatus.WAITING && !isDemo) {
        const joiningUser = await prisma.user.findUnique({ where: { id: userId }, select: { isBot: true } });
        const joinerIsReal = !joiningUser?.isBot;

        if (joinerIsReal && !gamesWithBotsInjectedPublic.has(gameId)) {
          const ticketsWithUsers = await prisma.ticket.findMany({
            where: { gameId },
            select: { userId: true, user: { select: { isBot: true } } }
          });
          const realUserIds = new Set(
            ticketsWithUsers.filter(t => !t.user.isBot).map(t => t.userId)
          );
          const realPlayerCount = realUserIds.size;

          if (houseBotEnabled && isBotRoom) {
            if (realPlayerCount >= 1) {
              if (!waitingTimers.has(gameId) && !gamesWithBotsInjectedPublic.has(gameId)) {
                gamesWithBotsInjectedPublic.add(gameId);
                try {
                  // Inject bots immediately so real players can see the full lobby
                  const currentTickets = await prisma.ticket.findMany({ where: { gameId }, select: { card: true } });
                  const takenCardIds = currentTickets.map(t => (t.card as any).id as number);

                  await injectBotTickets(gameId, game.room.type, takenCardIds);
                  const fullCount = await prisma.ticket.count({ where: { gameId } });
                  const botCount = BOT_COUNTS[game.room.type] ?? 30;
                  logger.info(`[HouseBot] Real player joined. Injected ${botCount} bots. Starting 20s countdown for game ${gameId}.`);

                  await Promise.all([
                    triggerGameEvent(gameId, 'player-joined', {
                      userId: 'bots',
                      playerCount: fullCount,
                      numTickets: botCount,
                      totalPrize: totalPrize.toString(),
                      serverTime: Date.now(),
                    }),
                    triggerGameEvent(game.roomId, 'player-count-update', { playerCount: fullCount }),
                  ]);

                  // Start the proper 20s countdown — ticks every second, game launches at 0s
                  await startCountdown(gameId, fullCount);
                } catch (e) {
                  gamesWithBotsInjectedPublic.delete(gameId);
                  logger.error('[HouseBot] Bot injection / auto-start error:', e);
                }
              }
            }
          } else {
            // REAL PLAYERS ONLY MODE
            if (realPlayerCount >= game.room.minPlayers) {
              logger.info(`[Game ${gameId}] Minimum real players reached (${realPlayerCount}/${game.room.minPlayers}). Auto-starting countdown.`);
              await startCountdown(gameId, currentTicketCount);
            }
          }
        }
      } else if (game.status === GameStatus.COUNTDOWN) {
        await triggerGameEvent(gameId, 'game-update', { playerCount });
      }

    } catch (e) {
      logger.error('JOIN POST-PROCESS ERROR:', e);
    }
  });

  return result;
}

// ─── Leave Game ────────────────────────────────────────────────
export async function leaveGame(userId: string, gameId: string): Promise<void> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { room: true },
  });

  if (!game) throw new Error('Game not found');
  if (game.status !== GameStatus.WAITING && game.status !== GameStatus.COUNTDOWN) {
    throw new Error('Cannot leave game that has already started');
  }

  await prisma.$transaction(async (tx) => {
    // 1. Get user's tickets
    const userTickets = await tx.ticket.findMany({ where: { userId, gameId } });
    const numTickets = userTickets.length;
    if (numTickets === 0) return; // Not in game

    // 2. Delete them
    await tx.ticket.deleteMany({ where: { userId, gameId } });

    // 3. Recalculate Prize Pool
    const allTickets = await tx.ticket.findMany({ where: { gameId } });
    const tCount = allTickets.length;
    const houseEdgePercent = config.game.houseEdgePercent;
    const totalSales = new Decimal(game.room.ticketPrice).mul(tCount);
    const houseEdge = totalSales.mul(houseEdgePercent).div(100);
    const prizePool = totalSales.sub(houseEdge);

    await tx.game.update({
      where: { id: gameId },
      data: { 
        totalPrize: prizePool,
        houseEdge: houseEdge
      }
    });
  });

  // Invalidate the cache for this active room
  try {
    const { clearActiveRoomCache } = await import('./room.manager');
    clearActiveRoomCache(game.room.type);
  } catch (e) {
    logger.warn('Failed to clear active room cache:', e);
  }

  // 5. Check if countdown needs to be aborted
  const allTicketsAfter = await prisma.ticket.findMany({ where: { gameId } });
  const uniqueUsersAfter = new Set(allTicketsAfter.map(t => t.userId));
  
  if (uniqueUsersAfter.size < 2 && game.status === GameStatus.COUNTDOWN && game.room.type !== 'DEMO') {
    const state = activeGames.get(gameId);
    if (state?.countdownInterval) clearInterval(state.countdownInterval);
    if (state?.countdownTimer) clearTimeout(state.countdownTimer);
    
    await prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.WAITING, countdownSeconds: 0 }
    });
    
    await triggerGameEvent(gameId, 'countdown-aborted', { reason: 'Not enough players' });
    logger.info(`[Game ${gameId}] Countdown aborted due to player leaving.`);
  }

  const updatedGameObj = await prisma.game.findUnique({
    where: { id: gameId },
    select: { totalPrize: true }
  });

  await triggerGameEvent(gameId, 'player-left', { 
    userId,
    playerCount: uniqueUsersAfter.size,
    totalPrize: updatedGameObj?.totalPrize?.toString()
  });
  
  logger.info(`[Game ${gameId}] User ${userId} left the game before start.`);
}

// ─── Resume Active Countdowns After Server Restart ────────────
// Called on startup: any game stuck in COUNTDOWN status gets its timer
// re-created so players see an accurate countdown instead of a frozen UI.
export async function resumeActiveCountdowns(): Promise<void> {
  try {
    const countdownGames = await prisma.game.findMany({
      where: { status: { in: [GameStatus.COUNTDOWN, GameStatus.WAITING] } },
      include: { room: true },
    });

    if (countdownGames.length === 0) return;

    logger.info(`[Recovery] Found ${countdownGames.length} game(s) in COUNTDOWN — resuming timers.`);

    for (const game of countdownGames) {
      const existingState = activeGames.get(game.id);
      if (existingState?.countdownInterval) {
        // Already ticking in memory — skip
        continue;
      }
      const ticketCount = await prisma.ticket.count({ where: { gameId: game.id } });
      // Re-start countdown (resets to configured seconds — clean recovery after restart)
      logger.info(`[Recovery] Re-starting countdown for game ${game.id} with ${ticketCount} tickets.`);
      await startCountdown(game.id, ticketCount);
    }
  } catch (e) {
    logger.error('[Recovery] Failed to resume active countdowns:', e);
  }
}

export function getActiveGames(): Map<string, ActiveGame> {
  return activeGames;
}
