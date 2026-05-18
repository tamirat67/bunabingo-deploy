import { Router, Request, Response } from 'express';
import { telegramAuthMiddleware, adminMiddleware } from '../middleware/auth';
import { depositLimiter, withdrawLimiter, joinGameLimiter } from '../middleware/rateLimit';
import { getOrCreateWallet, convertCoinsToBonus, COINS_PER_ETB } from '../services/wallet.service';
import { getUserDeposits, createDepositRequest, getPendingDeposits, approveDeposit, rejectDeposit } from '../services/deposit.service';
import { getUserWithdrawals, createWithdrawalRequest, getPendingWithdrawals, approveWithdrawal, rejectWithdrawal } from '../services/withdrawal.service';
import { getRooms, getRoomWithActiveGame, initializeRooms } from '../game/room.manager';
import { joinGame, createWaitingGame, leaveGame } from '../game/engine';
import { getAllUsers, suspendUser, banUser, findOrCreateUser } from '../services/user.service';
import { withRetry } from '../lib/prisma';
import { getJackpot } from '../services/jackpot.service';
import prisma from '../lib/prisma';
import multer from 'multer';
import path from 'path';
import { config } from '../config';
import { logger } from '../lib/logger';

// API Routes for Buna Bingo
const router = Router();

// File upload config
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

import authRouter from './auth';

// ─── PUBLIC Routes (no auth needed) ──────────────────────────
router.use('/auth', authRouter);

router.get('/rooms', async (_req: Request, res: Response) => {
  try {
    const rooms = await withRetry(() => getRooms());
    res.json(rooms);
  } catch (err) {
    logger.error('Failed to load rooms:', err);
    res.status(500).json({ error: 'Failed to load rooms' });
  }
});

// ─── Auth for all routes ──────────────────────────────────────
router.use(telegramAuthMiddleware);


// ─── Registration (Manual / Auto) ───────────────────────────
router.post('/auth/register', async (req: Request, res: Response) => {
  const tgUser = (req as any).tgUser; // Attached by middleware for unregistered users
  const { phoneNumber, referredById } = req.body;

  try {
    const user = await findOrCreateUser({
      id: tgUser.id,
      username: tgUser.username,
      first_name: tgUser.first_name,
      last_name: tgUser.last_name,
    }, referredById, phoneNumber);

    res.json({ 
      success: true, 
      user: {
        ...user,
        telegramId: user.telegramId.toString()
      } 
    });
  } catch (err: any) {
    const isNoAgent = err.message && err.message.includes('REGISTRATION_BLOCKED_NO_AGENT');
    const userMessage = isNoAgent ? err.message.split('REGISTRATION_BLOCKED_NO_AGENT:')[1].trim() : 'Registration failed';
    res.status(isNoAgent ? 400 : 500).json({ error: userMessage });
  }
});

router.post('/auth/verify-phone', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { contact } = req.body;
  if (!user) return res.status(401).json({ error: 'Not authorized' });
  
  const phoneNumber = contact?.phoneNumber || contact?.phone_number;
  if (!phoneNumber) return res.status(400).json({ error: 'No phone number provided' });

  try {
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { phone: phoneNumber }
    });
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    logger.error('Phone verification failed:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ─── User / Wallet ────────────────────────────────────────────
router.get('/me', async (req: Request, res: Response) => {
  try {
    let user = (req as any).user;
    const tgUser = (req as any).tgUser;

    // Auto-register: if Telegram sent us user data but they aren't in the DB yet, create them now
    if (!user && tgUser) {
      user = await findOrCreateUser({
        id: tgUser.id,
        username: tgUser.username,
        first_name: tgUser.first_name,
        last_name: tgUser.last_name,
      }, tgUser.startParam);
    }

    if (!user) return res.status(401).json({ error: 'Not registered' });

    // Ensure wallet exists with test bankroll (1000 ETB for testing purposes)
    let wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
    if (!wallet) {
      wallet = await prisma.wallet.create({ data: { userId: user.id, balance: 1000 } });
    } else if (Number(wallet.balance) < 1000) {
      wallet = await prisma.wallet.update({
        where: { userId: user.id },
        data: { balance: 1000 }
      });
      logger.info(`[Test] Automatically topped up user ${user.id} to 1000 ETB for testing`);
    }

    const jackpot = await getJackpot();

    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName ?? null,
      phoneNumber: user.phone ?? null,
      telegramId: user.telegramId?.toString(),
      telegramUsername: user.username,
      isAdmin: user.isAdmin,
      role: user.role,
      hasSeenJackpot: user.hasSeenJackpot,
      jackpot: {
        amount: jackpot.currentAmount.toString(),
        target: jackpot.targetAmount.toString()
      },
      wallet: {
        ...wallet,
        balance: wallet.balance.toString(),
        bonusBalance: wallet.bonusBalance.toString(),
        coins: wallet.coins,
        totalDeposited: wallet.totalDeposited.toString(),
        totalWithdrawn: wallet.totalWithdrawn.toString(),
        totalWon: wallet.totalWon.toString(),
        totalSpent: wallet.totalSpent.toString(),
      }
    });
  } catch (err: any) {
    logger.error('Wallet sync error:', err);
    const isNoAgent = err.message && err.message.includes('REGISTRATION_BLOCKED_NO_AGENT');
    const userMessage = isNoAgent ? err.message.split('REGISTRATION_BLOCKED_NO_AGENT:')[1].trim() : 'Failed to sync wallet balance';
    res.status(isNoAgent ? 400 : 500).json({ error: userMessage });
  }
});

// ─── Convert Coins → Bonus Balance ───────────────────────────
router.post('/me/coins/convert', async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Not authorized' });
  try {
    const result = await convertCoinsToBonus(user.id);
    res.json({ success: true, ...result, rate: `${COINS_PER_ETB} XP = 1 ETB bonus` });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ─── Mark Jackpot as Seen ────────────────────────────────────
router.post('/me/jackpot/seen', async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Not authorized' });
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { hasSeenJackpot: true }
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ─── Wallet Audit & Consistency ──────────────────────────────
router.get('/me/wallet/audit', async (req: Request, res: Response) => {
  const user = (req as any).user;
  try {
    const wallet = await getOrCreateWallet(user.id);
    const audit = await prisma.transaction.groupBy({
      where: { userId: user.id, status: 'COMPLETED' },
      by: ['type'],
      _sum: { amount: true }
    });
    const sums: Record<string, number> = {};
    audit.forEach(item => { sums[item.type] = Number(item._sum.amount || 0); });
    const trueBalance = (sums['DEPOSIT'] || 0) + (sums['PRIZE_WIN'] || 0) - (sums['TICKET_PURCHASE'] || 0) - (sums['WITHDRAWAL'] || 0);
    if (Math.abs(Number(wallet.balance) - trueBalance) > 0.01) {
      await prisma.wallet.update({ where: { id: wallet.id }, data: { balance: trueBalance } });
    }
    res.json({ mainBalance: trueBalance, bonusBalance: 0, coins: sums['PRIZE_WIN'] || 0, walletId: wallet.id });
  } catch (err) {
    res.status(500).json({ error: 'Wallet audit failed' });
  }
});

router.get('/me/profile', async (req: Request, res: Response) => {
  const user = (req as any).user;
  try {
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { 
        wallet: true,
        _count: {
          select: { winners: true }
        }
      }
    });

    if (!fullUser) return res.status(404).json({ error: 'User not found' });

    // Audit: Calculate total coins earned from transaction history
    const totalEarnings = await prisma.transaction.aggregate({
      where: { 
        userId: fullUser.id,
        type: 'PRIZE_WIN',
        status: 'COMPLETED'
      },
      _sum: { amount: true }
    });

    res.json({
      username: fullUser.telegramUsername || fullUser.firstName || 'User',
      balance: fullUser.wallet?.balance || 0,
      bonusBalance: fullUser.wallet?.bonusBalance || 0,
      gamesWon: fullUser._count.winners,
      totalCoins: totalEarnings._sum.amount || 0,
      role: fullUser.role,
      isAdmin: fullUser.isAdmin
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.post('/me/profile', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { firstName, phoneNumber } = req.body;
  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { 
        firstName: firstName || undefined,
        phone: phoneNumber || undefined,
      }
    });
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

router.get('/wallet', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const wallet = await getOrCreateWallet(user.id);
  res.json(wallet);
});

router.get('/transactions', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const page = parseInt(req.query.page as string) || 1;
  const limit = 20;
  const txns = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });
  res.json(txns);
});

// ─── Deposits ─────────────────────────────────────────────────
router.post('/deposits', depositLimiter, upload.single('screenshot'), async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Verification required to play' });
  try {
    const { amount, reference } = req.body;
    const screenshotUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
    const deposit = await createDepositRequest(user.id, parseFloat(amount), reference, screenshotUrl);
    res.json({ success: true, deposit });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/deposits', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const deposits = await getUserDeposits(user.id);
  res.json(deposits);
});

// ─── Withdrawals ──────────────────────────────────────────────
router.post('/withdrawals', withdrawLimiter, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Verification required to play' });
  try {
    const { amount, accountName, accountNumber, bankName } = req.body;
    // Parameter order in service: bankName, accountNumber, accountName
    const wd = await createWithdrawalRequest(user.id, parseFloat(amount), bankName, accountNumber, accountName);
    res.json({ success: true, withdrawal: wd });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/withdrawals', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const wds = await getUserWithdrawals(user.id);
  res.json(wds);
});

// ─── Games / Rooms ────────────────────────────────────────────
router.post('/games/join', joinGameLimiter, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Verification required to play' });
  try {
    const { roomType, cardIds } = req.body;
    
    let room = await prisma.room.findFirst({ where: { type: roomType as any, isActive: true } });
    if (!room) {
       await initializeRooms();
       room = await prisma.room.findFirst({ where: { type: roomType as any, isActive: true } });
    }

    if (!room) {
      return res.status(404).json({ error: "Game room not available." });
    }

    let gameId;
    if (room.type === 'DEMO') {
      // Force an entirely new private game for every DEMO join
      gameId = await createWaitingGame(room.id);
    } else {
      // Standard shared room logic
      const roomWithGame = await getRoomWithActiveGame(roomType as any);
      gameId = roomWithGame?.games[0]?.id;
      if (!gameId) {
        gameId = await createWaitingGame(room.id);
      }
    }

    if (!gameId) {
       return res.status(404).json({ error: "Game engine is busy. Please try again in 2 seconds." });
    }

    const { tickets, cards } = await joinGame(user.id, gameId, cardIds);
    res.json({ success: true, tickets, cards, gameId });
  } catch (e: any) {
    logger.error('JOIN GAME ERROR:', e);
    res.status(400).json({ 
      error: e.message || 'Server error during join',
      detail: e.stack
    });
  }
});

router.post('/games/:gameId/leave', async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Not authorized' });
  try {
    await leaveGame(user.id, req.params.gameId);
    res.json({ success: true });
  } catch (e: any) {
    logger.error('LEAVE GAME ERROR:', e);
    res.status(400).json({ error: e.message });
  }
});

// ─── Get Occupied Cards for Room ────────────────────────────
router.get('/rooms/:type/occupied', async (req: Request, res: Response) => {
  const { type } = req.params;
  const user = (req as any).user;
  try {
    const gameIdFromQuery = req.query.gameId as string;
    let gameId: string | undefined;
    let room: any;

    if (gameIdFromQuery) {
      gameId = gameIdFromQuery;
      room = await prisma.room.findFirst({ where: { type: type as any } });
    } else {
      room = await getRoomWithActiveGame(type as any);
      gameId = room?.games[0]?.id;
    }
    
    if (!gameId || !room) return res.json({ occupiedIds: [], myCardIds: [] });

    const tickets = await prisma.ticket.findMany({
      where: { gameId },
      select: { card: true, userId: true }
    });

    const myCardIds = user ? tickets.filter(t => t.userId === user.id).map(t => (t.card as any).id) : [];
    const otherOccupiedIds = user 
      ? tickets.filter(t => t.userId !== user.id).map(t => (t.card as any).id) 
      : tickets.map(t => (t.card as any).id);

    const playerCount = new Set(tickets.map(t => t.userId)).size;
    res.json({ 
      occupiedIds: otherOccupiedIds, 
      myCardIds, 
      gameId, 
      roomId: room.id, 
      playerCount 
    });
  } catch (e: any) {
    logger.error('Failed to fetch occupied cards:', e);
    res.status(500).json({ error: 'Failed to fetch occupied cards' });
  }
});

router.post('/games/:gameId/bingo', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { gameId } = req.params;
  const { checkWin } = await import('../game/card.generator');
  
  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { drawHistory: true }
    });
    
    if (!game) return res.status(404).json({ error: 'Game not found' });
    
    const tickets = await prisma.ticket.findMany({
      where: { userId: user.id, gameId }
    });
    
    const { claimBingoWin } = await import('../game/engine');
    const result = await claimBingoWin(gameId, user.id);
    
    res.json(result);
  } catch (err: any) {
    logger.error('Bingo claim failed:', err);
    res.status(400).json({ error: err.message || 'Verification failed' });
  }
});

router.post('/game/spin', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { stake, gameId } = req.body; 
  const { Decimal } = await import('@prisma/client/runtime/library');
  
  if (!user) return res.status(401).json({ error: 'Not authorized' });
  
  try {
    let finalStake = stake;
    let selectedNumbers: number[] = [];

    // ─── Mode 1: Ticket-based Spin (The "Heart" Logic) ─────────
    if (gameId) {
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { room: true, tickets: { where: { userId: user.id } } }
      });

      if (!game || !game.tickets.length) {
        return res.status(404).json({ error: 'No active spin ticket found' });
      }

      finalStake = Number(game.room.ticketPrice);
      
      // Extract all numbers from all tickets user has in this game
      game.tickets.forEach(ticket => {
        const cardData = ticket.card as any;
        const rows = Array.isArray(cardData) ? cardData : cardData.rows;
        rows.forEach((row: any) => {
          row.forEach((cell: any) => {
            if (typeof cell === 'number' && cell > 0) {
              selectedNumbers.push(cell);
            }
          });
        });
      });
    } 
    // ─── Mode 2: Direct Spin (Fall-back) ─────────
    else {
      const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
      if (!wallet || Number(wallet.balance) < stake) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }
      // If direct spin, we just simulate a card with 24 random numbers
      selectedNumbers = Array.from({ length: 24 }, () => Math.floor(Math.random() * 75) + 1);
    }
    
    // ─── THE DRAW ────────────────────────────────────────────────────────────
    const drawnNumber = Math.floor(Math.random() * 75) + 1;
    const isWin = selectedNumbers.includes(drawnNumber);
    
    // Determine prize (e.g., 2.5x stake for a hit)
    const prizeMultiplier = 2.5;
    const prizeAmount = isWin ? new Decimal(finalStake).mul(prizeMultiplier) : new Decimal(0);
    
    const result = await prisma.$transaction(async (tx) => {
       const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: user.id } });

       if (!gameId) {
         await tx.wallet.update({
           where: { userId: user.id },
           data: { 
             balance: { decrement: finalStake },
             totalSpent: { increment: finalStake }
           }
         });
         
         await tx.transaction.create({
           data: {
             userId: user.id,
             type: 'TICKET_PURCHASE',
             amount: finalStake,
             balanceBefore: wallet.balance,
             balanceAfter: new Decimal(wallet.balance).sub(finalStake),
             status: 'COMPLETED',
             description: `Direct Spin: ${finalStake} ETB`
           }
         });
       }
       
       if (isWin) {
         const midBalance = gameId ? wallet.balance : new Decimal(wallet.balance).sub(finalStake);
         const finalBalance = new Decimal(midBalance).add(prizeAmount);
         
         await tx.wallet.update({
           where: { userId: user.id },
           data: { 
             balance: finalBalance,
             totalWon: { increment: prizeAmount }
           }
         });
         
         await tx.transaction.create({
           data: {
             userId: user.id,
             type: 'PRIZE_WIN',
             amount: prizeAmount,
             balanceBefore: midBalance,
             balanceAfter: finalBalance,
             status: 'COMPLETED',
             referenceId: gameId || undefined,
             description: `Spin Win! Number ${drawnNumber} was on your card. Prize: ${prizeAmount} ETB`
           }
         });
       }

       if (gameId) {
         await tx.game.update({
           where: { id: gameId },
           data: { status: 'FINISHED', finishedAt: new Date() }
         });
       }
       
       return { drawnNumber, isWin, prizeAmount };
    });
    
    res.json({ 
      success: true, 
      drawnNumber: result.drawnNumber, 
      isWin: result.isWin, 
      prizeAmount: result.prizeAmount,
      // For the frontend wheel: map the drawn number to a segment or just tell it where to land
      // We'll simulate a 10-segment wheel for UI simplicity, where segment 0 is "Win" if isWin is true
      winIdx: result.isWin ? 1 : 6 
    });
    
  } catch (err: any) {
    logger.error('Spin error:', err);
    res.status(500).json({ error: 'Spin failed' });
  }
});

router.get('/games/:gameId', async (req: Request, res: Response) => {
  const game = await prisma.game.findUnique({
    where: { id: req.params.gameId },
    include: {
      room: true,
      drawHistory: { orderBy: { sequence: 'asc' } },
      winners: { include: { user: { select: { firstName: true, telegramUsername: true } } } },
      tickets: { select: { userId: true, isWinner: true } },
    },
  });
  if (!game) return res.status(404).json({ error: 'Game not found' });
  
  // Inject live state if available
  const { getActiveGames } = await import('../game/engine');
  const activeGames = getActiveGames();
  const state = activeGames.get(game.id);
  
  res.json({
    ...game,
    countdownSeconds: state?.secondsRemaining ?? (game as any).countdownSeconds,
    currentPlayers: state?.secondsRemaining !== undefined ? (game as any).tickets?.length : (game as any).currentPlayers,
    endTime: state?.secondsRemaining ? (Date.now() + state.secondsRemaining * 1000) : undefined,
    serverTime: Date.now()
  });
});

router.get('/games/:gameId/mycard', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const tickets = await prisma.ticket.findMany({
    where: { userId: user.id, gameId: req.params.gameId },
    include: { winners: true },
    orderBy: { purchasedAt: 'desc' }
  });
  // Always return 200 with empty array if no tickets — don't return 404
  // so the frontend Promise.all doesn't crash
  res.json({ tickets });
});

router.get('/mytickets', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const tickets = await prisma.ticket.findMany({
    where: { userId: user.id },
    include: {
      game: { include: { room: true } },
      winners: true,
    },
    orderBy: { purchasedAt: 'desc' },
    take: 20,
  });
  res.json(tickets);
});

router.get('/history', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const winners = await prisma.winner.findMany({
    where: { userId: user.id },
    include: { game: { include: { room: true } } },
    orderBy: { paidAt: 'desc' },
    take: 20,
  });
  res.json(winners);
});

router.get('/history/global', async (req: Request, res: Response) => {
  const winners = await prisma.winner.findMany({
    include: { 
      game: { include: { room: true } },
      user: { select: { firstName: true, telegramUsername: true } }
    },
    orderBy: { paidAt: 'desc' },
    take: 50,
  });
  res.json(winners);
});

// ─── Public Leaderboard ───────────────────────────────────────
router.get('/leaderboard', async (req: Request, res: Response) => {
  const timeframe = (req.query.timeframe as string) || 'today';
  let dateFilter = {};

  const now = new Date();
  if (timeframe === 'today') {
    dateFilter = { gte: new Date(now.setHours(0,0,0,0)) };
  } else if (timeframe === 'week') {
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);
    dateFilter = { gte: weekAgo };
  } else if (timeframe === 'month') {
    const monthAgo = new Date();
    monthAgo.setMonth(now.getMonth() - 1);
    dateFilter = { gte: monthAgo };
  }

  try {
    const topWinners = await prisma.winner.groupBy({
      by: ['userId'],
      where: { paidAt: dateFilter },
      _count: { id: true },
      _sum: { prizeAmount: true },
      orderBy: { _count: { id: 'desc' } },
      take: 100
    });

    const enriched = await Promise.all(topWinners.map(async (w, idx) => {
      const user = await prisma.user.findUnique({
        where: { id: w.userId },
        select: { firstName: true, telegramId: true, telegramUsername: true }
      });
      
      const rawTgId = user?.telegramId.toString() || '0000000000';
      const obfuscated = rawTgId.length > 5 
        ? rawTgId.slice(0, 5) + '**' + rawTgId.slice(-3) 
        : rawTgId;

      return {
        id: w.userId,
        name: user?.telegramUsername || user?.firstName || 'Buna Player',
        tgId: obfuscated,
        score: w._count.id,
        amount: Number(w._sum.prizeAmount || 0),
        rank: idx + 1
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ─── Socket.io (No legacy auth needed) ──────────────────────

// ─── Staff Routes (Admin & Agent) ─────────────────────────────
const staffRouter = Router();
staffRouter.use(async (req, res, next) => {
  const { agentMiddleware } = await import('../middleware/auth');
  agentMiddleware(req, res, next);
});

router.use('/admin', staffRouter);

// ─── Specific Admin-Only Routes ─────────────────────────────
const restrictToAdmin = async (req: Request, res: Response, next: any) => {
  const { adminMiddleware } = await import('../middleware/auth');
  adminMiddleware(req, res, next);
};

staffRouter.get('/deposits/pending', async (req, res) => {
  const admin = (req as any).user;
  const agentId = admin.isAdmin ? undefined : admin.id;
  res.json(await getPendingDeposits(agentId));
});
staffRouter.post('/deposits/:id/approve', async (req, res) => {
  const admin = (req as any).user;
  try {
    await approveDeposit(req.params.id, admin.id);
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
staffRouter.post('/deposits/:id/reject', async (req, res) => {
  const admin = (req as any).user;
  try {
    await rejectDeposit(req.params.id, admin.id, req.body.reason || 'Rejected');
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

staffRouter.get('/withdrawals/pending', async (req, res) => {
  const admin = (req as any).user;
  const agentId = admin.isAdmin ? undefined : admin.id;
  res.json(await getPendingWithdrawals(agentId));
});
staffRouter.post('/withdrawals/:id/approve', async (req, res) => {
  const admin = (req as any).user;
  try {
    await approveWithdrawal(req.params.id, admin.id);
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
staffRouter.post('/withdrawals/:id/reject', async (req, res) => {
  const admin = (req as any).user;
  try {
    await rejectWithdrawal(req.params.id, admin.id, req.body.reason || 'Rejected');
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

staffRouter.get('/users', async (req, res) => {
  const user = (req as any).user;
  const page = parseInt(req.query.page as string) || 1;
  const limit = 20;

  if (user.isAdmin) {
    // Admins see everyone
    res.json(await getAllUsers(page, limit));
  } else {
    // Agents only see their own referred players
    const { getPlayersUnderAgent } = await import('../services/user.service');
    res.json(await getPlayersUnderAgent(user.id, page, limit));
  }
});
staffRouter.post('/users/:id/suspend', async (req, res) => {
  const admin = (req as any).user;
  await suspendUser(req.params.id, admin.id, req.body.reason || '');
  res.json({ success: true });
});
staffRouter.post('/users/:id/ban', async (req, res) => {
  const admin = (req as any).user;
  await banUser(req.params.id, admin.id, req.body.reason || '');
  res.json({ success: true });
});

// ─── Admin-Only Management ──────────────────────────────────
staffRouter.get('/agents', restrictToAdmin, async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const { getAgents } = await import('../services/user.service');
  res.json(await getAgents(page));
});

staffRouter.post('/users/:id/promote', restrictToAdmin, async (req, res) => {
  const admin = (req as any).user;
  const { promoteToAgent } = await import('../services/user.service');
  try {
    await promoteToAgent(req.params.id, admin.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Promotion failed' });
  }
});

staffRouter.post('/agents/:id/recharge', restrictToAdmin, async (req, res) => {
  const admin = (req as any).user;
  const { amount } = req.body;
  const { rechargeAgentPreDepositWallet } = await import('../services/agentPreDeposit.service');
  try {
    const newBalance = await rechargeAgentPreDepositWallet(req.params.id, parseFloat(amount), admin.id);
    res.json({ success: true, newBalance });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});


staffRouter.post('/users/:id/demote', restrictToAdmin, async (req, res) => {
  const admin = (req as any).user;
  const { demoteFromAgent } = await import('../services/user.service');
  try {
    await demoteFromAgent(req.params.id, admin.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Demotion failed' });
  }
});

staffRouter.get('/analytics', restrictToAdmin, async (_req, res) => {
  const [
    totalUsers, totalGames, totalDeposits, totalWithdrawals,
    pendingDeposits, pendingWithdrawals, activeGames,
    globalSalesAgg, totalCompanyRevenueAgg
  ] = await Promise.all([
    prisma.user.count(),
    prisma.game.count({ where: { status: 'FINISHED' } }),
    prisma.deposit.aggregate({ where: { status: 'APPROVED' }, _sum: { amount: true } }),
    prisma.withdrawal.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.deposit.count({ where: { status: 'PENDING' } }),
    prisma.withdrawal.count({ where: { status: 'PENDING' } }),
    prisma.game.count({ where: { status: { in: ['RUNNING', 'COUNTDOWN', 'WAITING'] } } }),
    // Global Sales: Total spent on tickets by all players
    prisma.transaction.aggregate({ 
      where: { type: 'TICKET_PURCHASE', status: 'COMPLETED' }, 
      _sum: { amount: true } 
    }),
    // Total Company Revenue: Total of all 6.25% commissions collected
    prisma.agentCommissionLog.aggregate({ 
      where: { type: 'COMMISSION_DEBIT' }, 
      _sum: { amount: true } 
    }),
  ]);
  res.json({
    totalUsers, totalGames, activeGames,
    totalDeposited: totalDeposits._sum.amount || 0,
    totalWithdrawn: totalWithdrawals._sum.amount || 0,
    pendingDeposits, pendingWithdrawals,
    globalSales: globalSalesAgg._sum.amount || 0,
    totalCompanyRevenue: totalCompanyRevenueAgg._sum.amount || 0,
  });
});


staffRouter.get('/games/active', restrictToAdmin, async (_req, res) => {
  const games = await prisma.game.findMany({
    where: { status: { in: ['RUNNING', 'COUNTDOWN', 'WAITING'] } },
    include: {
      room: true,
      tickets: { select: { userId: true } },
      drawHistory: { orderBy: { sequence: 'desc' }, take: 1 },
    },
  });
  res.json(games);
});

staffRouter.get('/rooms', restrictToAdmin, async (_req, res) => {
  const rooms = await prisma.room.findMany({ orderBy: { ticketPrice: 'asc' } });
  res.json(rooms);
});

staffRouter.patch('/rooms/:id', restrictToAdmin, async (req, res) => {
  const { ticketPrice, minPlayers, isActive } = req.body;
  try {
    const updated = await prisma.room.update({
      where: { id: req.params.id },
      data: { 
        ticketPrice: ticketPrice !== undefined ? parseFloat(ticketPrice) : undefined,
        minPlayers: minPlayers !== undefined ? parseInt(minPlayers) : undefined,
        isActive: isActive !== undefined ? !!isActive : undefined
      }
    });
    res.json({ success: true, room: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update room' });
  }
});

staffRouter.get('/audit', restrictToAdmin, async (_req, res) => {
  const { auditAllWallets } = await import('../services/audit.service');
  const results = await auditAllWallets();
  res.json(results);
});

staffRouter.post('/users/:id/sync', restrictToAdmin, async (req, res) => {
  const admin = (req as any).user;
  const { syncUserWallet } = await import('../services/audit.service');
  try {
    await syncUserWallet(req.params.id, admin.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── System Settings (Admin only) ────────────────────────────
staffRouter.get('/settings', restrictToAdmin, async (_req, res) => {
  const { getSystemSetting } = await import('../services/settings.service');
  try {
    const [companyCommissionRate, agentProfitRate, receiverPhone, receiverName, telebirrPhone] = await Promise.all([
      getSystemSetting('COMPANY_COMMISSION_RATE'),
      getSystemSetting('AGENT_PROFIT_RATE'),
      getSystemSetting('PAYMENT_RECEIVER_PHONE'),
      getSystemSetting('PAYMENT_RECEIVER_NAME'),
      getSystemSetting('PAYMENT_TELEBIRR_PHONE'),
    ]);
    res.json({
      COMPANY_COMMISSION_RATE: companyCommissionRate || '12.5',
      AGENT_PROFIT_RATE: agentProfitRate || '12.5',
      PAYMENT_RECEIVER_PHONE: receiverPhone || '',
      PAYMENT_RECEIVER_NAME: receiverName || '',
      PAYMENT_TELEBIRR_PHONE: telebirrPhone || '',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

staffRouter.put('/settings', restrictToAdmin, async (req, res) => {
  const { setSystemSetting } = await import('../services/settings.service');
  const allowed = ['COMPANY_COMMISSION_RATE', 'AGENT_PROFIT_RATE', 'PAYMENT_RECEIVER_PHONE', 'PAYMENT_RECEIVER_NAME', 'PAYMENT_TELEBIRR_PHONE'];
  try {
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        await setSystemSetting(key, String(req.body[key]));
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ─── Agent Routes ─────────────────────────────────────────────
import agentRouter from './agent';
router.use('/agent', agentRouter);

// ─── Auth Routes ──────────────────────────────────────────────


export default router;
