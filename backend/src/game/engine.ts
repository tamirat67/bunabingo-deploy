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
  buildDeterministicSequence,
  clearBotInjectionRecord,
  creditBunaWallet,
  debitBunaWallet,
  recordCycleResult,
  getExpectedBotCount,
  getVisibleBotCount,
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
  botClaimLocked?: boolean;  // set IMMEDIATELY when bot wins — blocks all player claims before the delayed auto-claim fires
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

/**
 * Calculates the perfect mathematical minimum game length based on the total number of cards.
 * With more cards, Bingos happen naturally faster. We scale down the forced duration
 * to prevent the mathematical impossibility of avoiding an early Bingo at large scale.
 */
function getDynamicMinBalls(totalCards: number, houseShouldWin: boolean = false): number {
  // When house must win: use a natural-feeling minimum that still prevents player patterns.
  if (houseShouldWin) {
    // If there are many cards, it's mathematically impossible to draw 35 balls
    // without a real player winning. We MUST lower the threshold to ensure the Rig succeeds.
    if (totalCards > 150) return 9;
    if (totalCards > 100) return 12;
    if (totalCards > 50) return 15;
    if (totalCards > 20) return 20;
    return 25;
  }
  
  if (totalCards <= 40) return 30; // 90 seconds
  if (totalCards <= 80) return 25; // 75 seconds
  if (totalCards <= 150) return 22; // 66 seconds
  return 20; // 60 seconds
}

// ─── Determine Countdown ──────────────────────────────────────
function getCountdownSeconds(playerCount: number, roomType: string): number {
  const cdConfig = config.game.countdown as Record<string, number>;
  if (roomType in cdConfig) {
    return cdConfig[roomType];
  }
  return cdConfig.default ?? 30;
}

// ─── Visible Tickets Helper ───────────────────────────────────
export function getVisibleTickets(allTickets: any[], roomType: string): any[] {
  const realTix = allTickets.filter(t => !t.user?.isBot);
  const botTix = allTickets.filter(t => t.user?.isBot);
  // Use dynamic cyclical visible bot cap — decrements each game (30→20, 15→10)
  const visibleBotCap = getVisibleBotCount(roomType);
  const visibleBots = botTix.slice(0, visibleBotCap);
  return [...realTix, ...visibleBots];
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
    logger.info(`[Game ${gameId}] Loop Guard: 0 real players found. Restarting 50s countdown to wait for real players.`);
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

      // Charge house bots from the SystemWallet (real money) — not from a balance check
      if (botUserMap.get(userId) === true) {
        const botCharge = new Decimal(unitPrice).mul(numTickets);
        try {
          // Debit the SystemWallet for bot tickets — this makes the prize pool honest
          await debitBunaWallet(botCharge, `House bot tickets for game ${gameId} (${numTickets} × ${unitPrice} ETB)`);
        } catch (e) {
          logger.error(`[Game ${gameId}] Failed to debit SystemWallet for bot tickets:`, e);
        }
        totalPrizePool = totalPrizePool.add(prizeContribution);
        totalHouseEdge = totalHouseEdge.add(houseEdge);
        continue;
      }

      try {
        const { debitWallet } = await import('../services/wallet.service');
        await debitWallet(
          userId,
          totalCharge,
          'TICKET_PURCHASE',
          gameId,
          `Game started — ${numTickets} ticket(s) charged for ${game.room.type}`
        );
      } catch (err: any) {
        logger.warn(`[Game ${gameId}] User ${userId} has insufficient balance during charge loop (${err.message}) — removing tickets`);
        await prisma.ticket.deleteMany({ where: { gameId, userId } });
        continue;
      }

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

    // Note: Jackpot contribution is now handled in real-time live upon user ticket purchase inside joinGame()
  } else {
    logger.info(`[Game ${gameId}] DEMO game — skipping all financial logic.`);
  }

  // ─── Mark game as RUNNING (both real and DEMO) ────────────────────────────
  // Re-fetch current ticket count from DB — this is the authoritative count AFTER any
  // insufficient-balance deletions in the charge loop above, and after any async bot injections.
  let liveTicketCount = 0;
  if (isDemo) {
    liveTicketCount = game.tickets.length;
  } else {
    const allTix = await prisma.ticket.findMany({ where: { gameId }, include: { user: { select: { isBot: true } } } });
    const visibleTix = getVisibleTickets(allTix, game.room.type);
    liveTicketCount = visibleTix.length;
  }

  // ─── Guard: Abort if 0 tickets left after charge loop ───────────────────
  if (liveTicketCount === 0) {
    logger.warn(`[Game ${gameId}] 0 tickets remaining after charge loop. Cancelling game to avoid empty draw loop.`);
    await prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.CANCELLED, cancelledAt: new Date(), cancelReason: 'No tickets remaining after charge loop' },
    });
    await triggerGameEvent(gameId, 'game-cancelled', { gameId, reason: 'No valid tickets remaining' });
    return;
  }

  // Prize pool = 70% of ALL tickets (real players + house bots both pay real money now)
  // House commission = 30% of ALL tickets
  // Agent pre-deposit covers company commission (20%) from real player stakes only
  let displayPrizePool: Decimal;
  let displayHouseEdge: Decimal;
  const GUARANTEED_PRIZES: Record<string, number> = { CASUAL: 50, STANDARD: 100, PRO: 250, JACKPOT: 500, VIP: 1000 };
  
  if (isDemo) {
    displayPrizePool = new Decimal(100);
    displayHouseEdge = new Decimal(0);
  } else {
    // Use liveTicketCount — correctly reflects ALL tickets (real + bots) after all async ops settle
    const totalStake = new Decimal(unitPrice).mul(liveTicketCount);
    
    displayHouseEdge = totalStake.mul(houseEdgePercent).div(100);
    const calculatedPrizePool = totalStake.sub(displayHouseEdge); // 70% of all tickets
    
    const roomTypeName = game.room.type;
    const minPrize = GUARANTEED_PRIZES[roomTypeName] || 50;
    
    displayPrizePool = Decimal.max(new Decimal(minPrize), calculatedPrizePool);
    
    logger.info(`[Game ${gameId}] Cards: ${liveTicketCount} (${realPlayerCount} real + ${liveTicketCount - realPlayerCount} bots) × ${unitPrice} ETB | Prize Pool: ${displayPrizePool} ETB | House Edge: ${displayHouseEdge} ETB`);
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

  // Clear any pre-purchase reservations for this game now that it's running
  const { clearGameReservations } = await import('../lib/cardReservations');
  clearGameReservations(gameId);



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

  // Broadcast game-started with accurate, final ticket count and prize pool
  await triggerGameEvent(gameId, 'game-started', {
    gameId,
    playerCount: liveTicketCount,
    ticketCount: liveTicketCount,
    totalPrize: displayPrizePool.toFixed(0),
    prizePool: displayPrizePool.toFixed(2),
    serverTime: Date.now()
  });
  logger.info(`[Game ${gameId}] Game RUNNING with ${liveTicketCount} tickets (real + bots). Prize pool: ${displayPrizePool} ETB (70% of all stakes)`);


  // ─── Load tickets + Rig Draw Sequence (House Bot System) ────────────────────
  // Fetch all tickets including the isBot flag from the joined user
  const ticketsWithBotFlag = await prisma.ticket.findMany({
    where: { gameId },
    include: { user: { select: { isBot: true } } },
  });
  state.tickets = ticketsWithBotFlag;

  // Only rig non-DEMO rooms that have bots
  const hasBotPlayers = ticketsWithBotFlag.some(t => t.user?.isBot);
  if (!isDemo && hasBotPlayers) {
    // Count real player cards — this is fed to the safety gate inside shouldHouseWinThisGame.
    // The gate prevents false BINGO rejections when too many real cards make rigging impossible.
    const realPlayerCardCount = ticketsWithBotFlag.filter(t => !t.user?.isBot).length;
    logger.info(`[RiggedDraw] Game ${gameId} — Real player cards: ${realPlayerCardCount}`);

    const houseShouldWin = await shouldHouseWinThisGame(game.room.type, realPlayerCardCount);
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

    const dynamicMinBalls = getDynamicMinBalls(ticketsForSim.length, houseShouldWin);
    const riggedPool = buildDeterministicSequence(ticketsForSim, houseShouldWin, dynamicMinBalls, targetWinMode);
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
  // Also broadcast to room-type channel so guests on selection page get live calls
  await triggerGameEvent(state.roomType, 'number-drawn', {
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

        // ── Real player win notification (player-win games only) ──────────────
        // When houseShouldWin=false the bot will stay silent and a real player
        // should claim. Proactively push a 'bingo-ready' event to that player
        // so they know to tap the button — they shouldn't have to guess.
        if (ticket.user?.isBot !== true && state.houseShouldWin === false) {
          logger.info(`[Game ${gameId}] Real player ticket ${ticket.id} has BINGO (player-win game) — notifying user ${ticket.userId}.`);
          try {
            await triggerUserEvent(ticket.userId, 'bingo-ready', {
              gameId,
              ticketId: ticket.id,
              modes: result.modes,
              message: '🎉 You have BINGO! Tap the BINGO button now!',
            });
          } catch (notifyErr) {
            logger.warn(`[Game ${gameId}] Failed to send bingo-ready notification to ${ticket.userId}:`, notifyErr);
          }
          // Don't break — continue scanning so ALL winning real players are notified.
          continue;
        }

        // Auto-claim for house bots
        if (ticket.user?.isBot === true) {
           // On the player-win game, bots stay completely silent.
           // The real player will win naturally by claiming their own pattern.
           if (state.houseShouldWin === false) {
             logger.info(`[Game ${gameId}] Bot has pattern but staying silent — this is the player-win game.`);
             continue;
           }

           // Pause draw immediately
           if (state?.drawInterval) {
             clearInterval(state.drawInterval);
             state.drawInterval = undefined;
           }

           // ── CRITICAL: Lock the game against ALL player claims IMMEDIATELY ──────────────
           // botClaimLocked is checked first in claimBingoWin (before any DB query),
           // so this single flag closes the race window with zero latency.
           if (state) {
             state.botClaimLocked = true;
             state.pendingBotClaim = true;
           }

           // Pick the highest priority winning mode from the result
           const priority = ['FULL_HOUSE', 'FOUR_CORNERS', 'DIAGONAL', 'COLUMN', 'ROW'];
           let capturedWinMode = result.modes[0];
           for (const p of priority) {
             if (result.modes.includes(p as any)) {
               capturedWinMode = p as any;
               break;
             }
           }

           // 200ms delay — enough for clients to render the last ball, but impossibly
           // short for any human finger to tap and submit a claim.
           const delayMs = 200;
           logger.info(`[Game ${gameId}] BOT WINNER DETECTED! Auto-claiming in ${delayMs}ms for ${capturedWinMode}...`);

           setTimeout(async () => {
             const gameCheck = await prisma.game.findUnique({ where: { id: gameId } });
             const currentState = activeGames.get(gameId);

             if (!gameCheck || gameCheck.status === GameStatus.FINISHED || gameCheck.status === GameStatus.CANCELLED) {
               logger.info(`[Game ${gameId}] Bot claim skipped — game already ${gameCheck?.status ?? 'GONE'}`);
               if (currentState) { currentState.pendingBotClaim = false; currentState.botClaimLocked = false; }
               return;
             }

             if (gameCheck.status !== GameStatus.RUNNING) {
               logger.warn(`[Game ${gameId}] Bot claim cancelled — unexpected status ${gameCheck.status}. Resuming draw interval.`);
               if (currentState) {
                 currentState.pendingBotClaim = false;
                 currentState.botClaimLocked = false;
                 if (!currentState.drawInterval) {
                   currentState.drawInterval = setInterval(() => drawNumber(gameId), config.game.drawIntervalMs);
                 }
               }
               return;
             }

             try {
               const latestState = activeGames.get(gameId);
               const finalDrawn = latestState ? latestState.drawnNumbers : drawnNumbers;
               await processWinner(gameId, ticket.userId, ticket.id, capturedWinMode, finalDrawn);
               await finishGame(gameId, `House Bot Bingo claimed: ${capturedWinMode}`);
             } catch (err: any) {
               logger.error(`[Game ${gameId}] Bot auto-claim failed:`, err);
               // If bot claim fails, release the lock and resume draw so game doesn't freeze
               if (currentState) {
                 currentState.pendingBotClaim = false;
                 currentState.botClaimLocked = false;
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
           return;
        }
    }
  }
}

// ─── Claim Bingo Win (Optimized) ─────────────────────────────────
export async function claimBingoWin(gameId: string, userId: string): Promise<{ won: boolean; mode?: string; prize?: number; error?: string }> {
  const state = activeGames.get(gameId);

  // ── RACE CONDITION PROTECTION (checked FIRST) ────────────
  // Only block claims if the bot has already detected a win and is in the 200ms process of claiming.
  // We no longer artificially block claims during the whole game (houseShouldWin) — instead, we rely on
  // the mathematical rig algorithm which ensures player cards simply never form a complete pattern.
  // When a player taps BINGO, we do an honest check, find no pattern, and reject naturally.
  if (state?.botClaimLocked === true) {
    logger.info(`[Game ${gameId}] Player ${userId} claim blocked — bot is currently claiming (botClaimLocked=true)`);
    return { won: false, error: 'Someone else already yelled BINGO! Verifying...' };
  }

  // ── STRICT ARTIFICIAL BLOCK REMOVED ────────────
  // We no longer manually block claims here because the 400-bot injection mathematically
  // guarantees the bots will win before any real player naturally completes a pattern.

  // Immediately pause the draw interval in memory to stop calling new balls
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

    const tickets = await prisma.ticket.findMany({
      where: { gameId, userId },
      select: { id: true, card: true }
    });

    const drawnNumbers = game.drawHistory.map(d => d.number);
    const existingWinModes = new Set(game.winners.map(w => w.winMode));

    // Scan ALL tickets before deciding — pick the globally highest-priority win mode.
    // (Old code stopped at the first winning ticket, potentially missing FULL_HOUSE on ticket #2
    //  because ROW was found on ticket #1. Prize is the same regardless, but mode display was wrong.)
    let eligibleClaim: { ticketId: string; mode: any; pIdx: number } | null = null;
    const priority = ['FULL_HOUSE', 'FOUR_CORNERS', 'DIAGONAL', 'COLUMN', 'ROW'] as const;

    for (const ticket of tickets) {
      const rows = parseCardRows(ticket.card);
      if (!rows) {
        logger.warn(`Skipping user ticket ${ticket.id} due to card parsing failure.`);
        continue;
      }
      const result = checkWin(rows, drawnNumbers);

      if (result.won) {
        for (let i = 0; i < priority.length; i++) {
          const mode = priority[i];
          if (result.modes.includes(mode as any) && !existingWinModes.has(mode as any)) {
            // Update only if this ticket has a higher-priority (lower index) mode than current best
            if (!eligibleClaim || i < eligibleClaim.pIdx) {
              eligibleClaim = { ticketId: ticket.id, mode: mode as any, pIdx: i };
            }
            break; // best mode found for this ticket — move to next ticket
          }
        }
        // Early exit: FULL_HOUSE (pIdx=0) can't be beaten
        if (eligibleClaim?.pIdx === 0) break;
      }
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

  // ─── Perform all winner logic in ONE TRANSACTION with row-level lock ───
  await prisma.$transaction(async (tx) => {
    // 0a. ATOMIC LOCK on the game row — prevents two concurrent bingo claims from
    //     both passing the existingWinner check and double-crediting the prize.
    await tx.$queryRaw`SELECT id FROM games WHERE id = ${gameId}::uuid FOR UPDATE`;

    // 0b. RACE CONDITION GUARD: ensure NO winners exist for this game yet
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
      // Lock the wallet row before reading & crediting it
      await tx.$queryRaw`SELECT id FROM wallets WHERE user_id = ${userId}::uuid FOR UPDATE`;
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
  // Now that bots pay real money (SystemWallet debited in runGame), the SystemWallet
  // holds the full prize pool (70% of ALL tickets = real + bots). Winner payouts
  // are debited from this reserve.
  if (!isDemo) {
    if (!isHouseBot) {
       // Real player won: deduct prize from the reserve
       await debitBunaWallet(prizeAmount, `Guaranteed payout to real player [${winMode}] Game: ${gameId}`);
       await recordCycleResult(game.room.type, false);
       logger.info(`[SystemWallet] Deducted guaranteed prize of ${prizeAmount} ETB for Game ${gameId}`);
    } else {
       // House bot won: prize stays in the reserve (SystemWallet was already debited
       // for bot tickets in runGame when they were charged). Record the cycle result.
       await recordCycleResult(game.room.type, true);
       logger.info(`[SystemWallet] House bot won Game ${gameId} — prize retained in reserve`);

       // ─── Bot Debt Tracking ───
       try {
         const { logBotAdvantageDebt } = await import('../services/agentPreDeposit.service');
         await logBotAdvantageDebt(gameId, new Decimal(game.room.ticketPrice.toString()));
       } catch (err) {
         logger.error(`[BotDebt] Failed to assign bot debt for Game ${gameId}:`, err);
       }
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
  const capturedRoomType = state?.roomType; // capture before delete
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
    orderBy: { id: 'asc' },
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
    'Abebe', 'Kebede', 'Tesfahun', 'Tesfaye', 'Girma', 'Tadesse', 'Haile',
    'Dawit', 'Bereket', 'Solomon', 'Yonas', 'Fitsum', 'Ermias', 'Mulugeta',
    'Getachew', 'Mekonnen', 'Amanuel', 'Henok', 'Natnael', 'Biniam',
    'Teklay', 'Yohannes', 'Tewodros', 'Feleke', 'Bekele', 'Alemayehu',
    'Getu', 'Degu', 'Worku', 'Tigistu', 'Gadisa', 'Tolosa', 'Dereje',
    'Hussein', 'Abel', 'Challa', 'Gemechu', 'Tilahun', 'Ephrem', 'Surafel',
    'Kidus', 'Robel', 'Eyob', 'Berhane', 'Tsegay', 'Kibrom', 'Hagos',
    'Bisrat', 'Semere', 'Wendwessen', 'Zelalem', 'Matias', 'Mikias', 'Nahom',
    'Samuel', 'Elias', 'Kaleb', 'Abdi', 'Fikru', 'Sirak', 'Leul',
    'Desalegn', 'Teshome', 'Assefa', 'Alemu', 'Zerihun', 'Belay', 'Wondwosen',
    'Mengstu', 'Aschalew', 'Shiferaw', 'Endalkachew', 'Melaku', 'Ayele', 'Belachew',
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
      displayName,          // ← single source of truth: always use this on frontend, never recompute
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
  // ── Also broadcast to the room-type channel so ALL guests on the selection
  // page (who joined via room-type string, not the running gameId) receive the
  // winner announcement.  This mirrors how number-drawn and occupied-sync work.
  if (capturedRoomType) {
    await triggerGameEvent(capturedRoomType, 'game-finished', {
      gameId,
      reason,
      winners: publicWinners,
      gamePrize: safeTotalPrize,
      drawnNumbers: state?.drawnNumbers || []
    });
  }
  await triggerAdminEvent('game-finished', { gameId, reason });
  logger.info(`[Game ${gameId}] Finished: ${reason}`);

  // Clean up the double-finish guard
  gamesBeingFinished.delete(gameId);

  // Auto-create new waiting game for the same room so it's ready immediately.
  // If a real player joins → bots are injected and countdown starts.
  // If nobody joins within 2.5 minutes → the waitingTimer fires, injects bots and force-starts.
  await createWaitingGame(updatedGame.roomId);
}

// ─── Recalculate Prize Pool Helper ────────────────────────────
export async function recalculateGamePrizePool(gameId: string, ticketPrice: Decimal | number): Promise<{ totalPrize: string; houseEdge: string }> {
  return await withRetry(async () => {
    return prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({ where: { id: gameId }, include: { room: true } });
      const allTickets = await tx.ticket.findMany({ where: { gameId }, include: { user: { select: { isBot: true } } } });
      const visibleTickets = getVisibleTickets(allTickets, game!.room.type);
      const fullCount = visibleTickets.length;
      const houseEdgePercent = config.game.houseEdgePercent;
      
      const totalStakeAll = new Decimal(ticketPrice).mul(fullCount);
      const houseEdge = totalStakeAll.mul(houseEdgePercent).div(100);
      const prizePool = totalStakeAll.sub(houseEdge);

      await tx.game.update({
        where: { id: gameId },
        data: { totalPrize: prizePool, houseEdge: houseEdge }
      });
      
      return { totalPrize: prizePool.toString(), houseEdge: houseEdge.toString() };
    });
  });
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
          const expectedBots = getExpectedBotCount(room.type);
          const isBotRoom = expectedBots > 0;

          if (botEnabled && isBotRoom) {
            logger.info(`[Engine] Auto-injecting bots into new game ${newGame.id} (${room.type}).`);
            await injectBotTickets(newGame.id, room.type, []);
            fullCount = await prisma.ticket.count({ where: { gameId: newGame.id } });
            
            const updatedPrize = await recalculateGamePrizePool(newGame.id, room.ticketPrice);
            gamesWithBotsInjectedPublic.add(newGame.id);

            await Promise.all([
              triggerGameEvent(newGame.id, 'player-joined', {
                userId: 'bots',
                playerCount: expectedBots, // Bots each have a unique user ID, so playerCount = expectedBots
                numTickets: fullCount,
                ticketCount: fullCount, // Explicitly separate ticketCount
                totalPrize: updatedPrize.totalPrize,
                serverTime: Date.now(),
              }),
              triggerGameEvent(room.id, 'player-count-update', { playerCount: expectedBots, ticketCount: fullCount }),
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
      const allTickets = await tx.ticket.findMany({ where: { gameId }, include: { user: { select: { isBot: true } } } });
      const gameObj = await tx.game.findUnique({ where: { id: gameId }, include: { room: true } });
      const visibleTickets = getVisibleTickets(allTickets, gameObj!.room.type);
      
      const uniqueUsers = new Set(visibleTickets.map(t => t.userId));
      const pCount = uniqueUsers.size;
      const tCount = visibleTickets.length; // UI shows visible tickets only

      // 7. Calculate & Update prize pool (All tickets — real + bots — contribute equally.
      //    Bots are now charged real money from SystemWallet in runGame(), so the prize
      //    pool is simply 70% of ALL ticket sales.)
      const houseEdgePercent = config.game.houseEdgePercent;
      
      const totalStakeAll = new Decimal(unitPrice).mul(tCount);
      // House edge = 30% of ALL ticket sales (bots included — SystemWallet covers it)
      const houseEdge = totalStakeAll.mul(houseEdgePercent).div(100);
      const prizePool = totalStakeAll.sub(houseEdge); // 70% of all tickets

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
      const { getHouseBotEnabled } = await import('../services/settings.service');
      const isDemo = game.room.type === 'DEMO';
      // ─── Update in-memory state ─────────────────────────────────────────
      const currentState = activeGames.get(gameId);
      if (currentState) {
        currentState.ticketCount = currentTicketCount;
      }

      // ─── Max Wait Time Timeout Trigger ──────────────────────────────────
      if (game.status === GameStatus.WAITING && !isDemo && !waitingTimers.has(gameId)) {
        const maxWaitTimeMs = 50 * 1000; // 50 seconds
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
              const botEnabled = await getHouseBotEnabled();
              const expectedBots = getExpectedBotCount(checkGame.room.type);
              const isBotRoom = expectedBots > 0;
              if (botEnabled && isBotRoom) {
                const hasBots = checkGame.tickets.some(t => t.user?.isBot);
                if (!hasBots) {
                  const takenCardIds = checkGame.tickets.map(t => (t.card as any).id as number);
                  await injectBotTickets(gameId, checkGame.room.type, takenCardIds);
                  const fullCount = await prisma.ticket.count({ where: { gameId } });
                  const botCount = expectedBots;
                  
                  const updatedPrize = await recalculateGamePrizePool(gameId, checkGame.room.ticketPrice);
                  
                  const uniqueUsers = await prisma.ticket.findMany({ where: { gameId }, select: { userId: true }, distinct: ['userId'] });
                  const pCountWithBots = uniqueUsers.length;
                  
                  await Promise.all([
                    triggerGameEvent(gameId, 'player-joined', {
                      userId: 'bots',
                      playerCount: pCountWithBots,
                      numTickets: botCount,
                      ticketCount: fullCount,
                      totalPrize: updatedPrize.totalPrize,
                      serverTime: Date.now(),
                    }),
                    triggerGameEvent(checkGame.roomId, 'player-count-update', { playerCount: pCountWithBots, ticketCount: fullCount }),
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
        logger.info(`[Engine] Scheduled 50-second max wait timeout for game ${gameId}`);
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
        triggerGameEvent(gameId, 'occupied-sync', { tickets: ticketData, playerCount: playerCount, ticketCount: currentTicketCount, gameId }),
        triggerGameEvent(game.room.type, 'occupied-sync', { tickets: ticketData, playerCount: playerCount, ticketCount: currentTicketCount, gameId }),
        triggerGameEvent(gameId, 'player-joined', { 
          userId, 
          playerCount: playerCount, // Use pre-calculated unique users
          numTickets,
          ticketCount: currentTicketCount, // Send explicit total tickets
          totalPrize: totalPrize.toString(),
          secondsRemaining: currentState?.secondsRemaining,
          endTime,
          serverTime: Date.now()
        }),
        triggerUserEvent(userId, 'join-success', { gameId, numTickets }),
        triggerGameEvent(game.roomId, 'player-count-update', { playerCount: playerCount, ticketCount: currentTicketCount }),
        triggerAdminEvent('player-joined', {
          gameId,
          userId,
          room: game.room.type,
          totalTickets: numTickets,
          pool: totalPrize.toString()
        }),
      ]);

      // ─── House Bot Injection + Auto-Start ───────────────────────────────
      const houseBotEnabled = await getHouseBotEnabled();
      const expectedBots = getExpectedBotCount(game.room.type);
      const isBotRoom = expectedBots > 0;

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
                  const fullTickets = await prisma.ticket.findMany({ where: { gameId }, include: { user: { select: { isBot: true } } } });
                  const fullVisible = getVisibleTickets(fullTickets, game.room.type);
                  const botCount = expectedBots;
                  
                  const updatedPrize = await recalculateGamePrizePool(gameId, game.room.ticketPrice);
                  
                  logger.info(`[HouseBot] Real player joined. Injected ${botCount} bots. Starting 50s countdown for game ${gameId}.`);

                  await Promise.all([
                    triggerGameEvent(gameId, 'player-joined', {
                      userId: 'bots',
                      ticketCount: fullVisible.length,
                      totalPrize: updatedPrize.totalPrize,
                      serverTime: Date.now(),
                    }),
                    triggerGameEvent(game.roomId, 'player-count-update', { playerCount: fullVisible.length }),
                  ]);

                  // Start the proper 50s countdown — ticks every second, game launches at 0s
                  await startCountdown(gameId, fullVisible.length);
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
    const allTickets = await tx.ticket.findMany({ where: { gameId }, include: { user: { select: { isBot: true } } } });
    const visibleTickets = getVisibleTickets(allTickets, game.room.type);
    const tCount = visibleTickets.length;
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

// ─── Resume RUNNING Games After Server Restart ──────────────────────────────
export async function resumeRunningGames(): Promise<void> {
  try {
    const runningGames = await prisma.game.findMany({
      where: { status: GameStatus.RUNNING },
      include: { 
        room: true,
        drawHistory: { orderBy: { sequence: 'asc' } },
        tickets: { include: { user: { select: { isBot: true } } } }
      },
    });

    if (runningGames.length === 0) return;

    logger.info(`[Recovery] Found ${runningGames.length} game(s) in RUNNING status — resuming draws.`);

    for (const game of runningGames) {
      
      const existingState = activeGames.get(game.id);
      if (existingState?.drawInterval) continue; // already ticking

      const drawnNumbers = game.drawHistory.map(d => d.number);
      const drawnSet = new Set(drawnNumbers);
      const pool = buildNumberPool().filter(n => !drawnSet.has(n));

      // Recreate state
      const state: ActiveGame = {
        gameId: game.id,
        roomType: game.room.type as any,
        drawnNumbers,
        numberPool: pool,
        tickets: game.tickets,
        ticketCount: game.tickets.length,
      };

      // Restore house bot rig state if bots exist and it's not a demo
      const hasBotPlayers = game.tickets.some(t => t.user?.isBot);
      if (game.room.type !== 'DEMO' && hasBotPlayers) {
        state.houseShouldWin = await shouldHouseWinThisGame(game.room.type);
        const WIN_MODE_ROTATION = ['ROW', 'COLUMN', 'DIAGONAL', 'FOUR_CORNERS', 'ROW', 'COLUMN', 'DIAGONAL', 'FOUR_CORNERS'];
        let modeHash = 0;
        for (let i = 0; i < game.id.length; i++) {
          modeHash = game.id.charCodeAt(i) + ((modeHash << 5) - modeHash);
        }
        state.targetWinMode = WIN_MODE_ROTATION[Math.abs(modeHash) % WIN_MODE_ROTATION.length];
        
        const ticketsForSim = game.tickets.map(t => ({
          userId: t.userId,
          card: t.card,
          isBot: t.user?.isBot ?? false,
        }));
        
        // Rig the remaining pool using dynamic balls based on total tickets
        const dynamicMinBalls = getDynamicMinBalls(ticketsForSim.length);
        state.numberPool = buildDeterministicSequence(ticketsForSim, state.houseShouldWin, dynamicMinBalls, state.targetWinMode).filter(n => !drawnSet.has(n));
      }

      activeGames.set(game.id, state);
      
      state.drawInterval = setInterval(() => drawNumber(game.id), config.game.drawIntervalMs);
      logger.info(`[Recovery] Resumed draw loop for game ${game.id} (already drawn ${drawnNumbers.length} balls).`);
    }
  } catch (e) {
    logger.error('[Recovery] Failed to resume running games:', e);
  }
}

export function getActiveGames(): Map<string, ActiveGame> {
  return activeGames;
}
