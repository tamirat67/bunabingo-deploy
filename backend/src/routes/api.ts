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
import { logAdminAction } from '../services/log.service';

// API Routes for Buna Bingo
const router = Router();

// File upload config — ensure uploads directory exists
import fs from 'fs';
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.info(`[Upload] Created uploads directory at: ${uploadsDir}`);
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only ${allowed.join(', ')} are allowed.`) as any, false);
    }
  },
});

/** Helper: wrap multer middleware to return JSON on error instead of crashing */
function runUpload(req: Request, res: Response, middleware: any): Promise<void> {
  return new Promise((resolve, reject) => {
    middleware(req, res, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

import authRouter from './auth';

// ─── PUBLIC Routes (no auth needed) ──────────────────────────
router.use('/auth', authRouter);

router.get('/rooms', async (_req: Request, res: Response) => {
  try {
    const { getVisibleBotCount } = await import('../services/houseBot.service');
    const rooms = await withRetry(() => getRooms());
    const augmentedRooms = rooms.map(r => ({
      ...r,
      expectedBotCount: getVisibleBotCount(r.type)
    }));
    res.json(augmentedRooms);
  } catch (err) {
    logger.error('Failed to load rooms:', err);
    res.status(500).json({ error: 'Failed to load rooms' });
  }
});

// ─── Public: Single Promotion (no auth — for Read More page) ──
router.get('/promotions/:id/public', async (req: Request, res: Response) => {
  try {
    const promo = await prisma.promotion.findUnique({ where: { id: req.params.id } });
    if (!promo) return res.status(404).json({ error: 'Promotion not found' });
    res.json(promo);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load promotion' });
  }
});


import axios from 'axios';

// ─── Serve Telegram Files ──────────────────────────────────────
router.get('/file/:fileId', async (req: Request, res: Response) => {
  try {
    const fileId = req.params.fileId;
    // Don't proxy if it's already an http URL
    if (fileId.startsWith('http')) {
      return res.redirect(fileId);
    }
    
    // Get file info from Telegram
    const response = await axios.get(`https://api.telegram.org/bot${config.bot.token}/getFile?file_id=${fileId}`);
    if (response.data?.ok && response.data?.result?.file_path) {
      const filePath = response.data.result.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${config.bot.token}/${filePath}`;
      res.redirect(fileUrl);
    } else {
      res.status(404).send('File not found');
    }
  } catch (err) {
    logger.error(`[API] Failed to proxy Telegram file:`, err);
    res.status(500).send('Error fetching file');
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

    let wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
    if (!wallet) {
      wallet = await prisma.wallet.create({ data: { userId: user.id, balance: 0 } });
    }

    const jackpot = await getJackpot();

    let referrerData = null;
    if (user.referredBy) {
      const ref = await prisma.user.findUnique({
        where: { id: user.referredBy },
        select: { telegramUsername: true, depositPhones: true }
      });
      if (ref) {
        referrerData = {
          telegramUsername: ref.telegramUsername,
          depositPhones: ref.depositPhones,
        };
      }
    }

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
      referralCode: user.referralCode,
      referrer: referrerData,
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
        referrer: {
          select: { telegramUsername: true }
        },
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

    const referralsCount = await prisma.user.count({
      where: { referredBy: fullUser.id }
    });

    res.json({
      id: fullUser.id,
      username: fullUser.telegramUsername || fullUser.firstName || 'User',
      balance: fullUser.wallet?.balance || 0,
      bonusBalance: fullUser.wallet?.bonusBalance || 0,
      gamesWon: fullUser._count.winners,
      totalCoins: totalEarnings._sum.amount || 0,
      role: fullUser.role,
      isAdmin: fullUser.isAdmin,
      referralCode: fullUser.referralCode,
      referralsCount,
      referrerUsername: fullUser.referrer?.telegramUsername || null,
      wallet: {
        id: fullUser.wallet?.id,
        userId: fullUser.wallet?.userId,
        balance: fullUser.wallet?.balance ? fullUser.wallet.balance.toString() : '0',
        bonusBalance: fullUser.wallet?.bonusBalance ? fullUser.wallet.bonusBalance.toString() : '0',
        referralBalance: fullUser.wallet?.referralBalance ? fullUser.wallet.referralBalance.toString() : '0',
        coins: fullUser.wallet?.coins || 0
      }
    });
  } catch (err) {
    logger.error('Failed to fetch profile:', err);
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
      // ─── Demo Play Limit: max 10 free games per user ────────────────────────
      const demoPlaysCount = await prisma.game.count({
        where: {
          room: { type: 'DEMO' },
          tickets: { some: { userId: user.id } },
        },
      });

      const DEMO_LIMIT = 10;
      if (demoPlaysCount >= DEMO_LIMIT) {
        return res.status(403).json({
          error: 'DEMO_LIMIT_REACHED',
          message: `🎮 የ${DEMO_LIMIT} ነፃ ዲሞ ጨዋታዎ ጊዜ አልቋል!\n\n💰 እውነተኛ ጨዋታ ለመጫወት እና ሽልማት ለማሸነፍ፣ እባክዎ ወደ ዋሌት ሂደው ገንዘብ ያስቀምጡ።\n\n(You have used all ${DEMO_LIMIT} free demo games! Please deposit to play real games and win real prizes.)`
        });
      }

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
    
    // Release pre-purchase reservations now that real tickets exist
    const { releaseCards } = await import('../lib/cardReservations');
    releaseCards(gameId, cardIds, user.id);

    res.json({ success: true, tickets, cards, gameId });
  } catch (e: any) {
    // ── Structured handling: game is currently RUNNING ────────────────────────
    if (e.code === 'GAME_IN_PROGRESS') {
      return res.status(400).json({
        error: 'GAME_IN_PROGRESS',
        message: 'A game is currently in progress. Cartela selling is temporarily stopped. Please wait for the game to finish to buy cartelas for the next round.',
      });
    }
    logger.error('JOIN GAME ERROR:', e);
    const isAlreadyTaken = e.message && (e.message.includes('already taken') || e.message.includes('taken'));
    res.status(400).json({ 
      error: isAlreadyTaken ? 'CARD_ALREADY_TAKEN' : (e.message || 'Server error during join'),
      message: e.message || 'Server error during join',
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
const occupiedCache = new Map<string, { data: any; timestamp: number }>();
const OCCUPIED_CACHE_DURATION_MS = 800;         // 0.8s cache for WAITING/COUNTDOWN
const OCCUPIED_CACHE_RUNNING_MS  = 200;          // 0.2s cache when game is RUNNING (so finish is detected fast)

router.get('/rooms/:type/occupied', async (req: Request, res: Response) => {
  const { type } = req.params;
  const user = (req as any).user;
  const gameIdFromQuery = req.query.gameId as string;
  const cacheKey = `${type}_${gameIdFromQuery || 'active'}_${user?.id || 'guest'}`;

  if (occupiedCache.size > 1000) {
    occupiedCache.clear();
  }

  const now = Date.now();
  const cached = occupiedCache.get(cacheKey);
  const cacheTTL = cached?.data?.isGameRunning ? OCCUPIED_CACHE_RUNNING_MS : OCCUPIED_CACHE_DURATION_MS;
  if (cached && (now - cached.timestamp < cacheTTL)) {
    return res.json(cached.data);
  }

  try {
    let gameId: string | undefined;
    let isGameRunning = false;

    // 1. Fetch the room first (don't require isActive: true here, so we don't falsely report a live game as stopped just because the admin toggled it)
    const room = await prisma.room.findFirst({
      where: { type: type as any }
    });

    if (!room) {
      const responseData = { occupiedIds: [], myCardIds: [], isGameRunning: false };
      occupiedCache.set(cacheKey, { data: responseData, timestamp: now });
      return res.json(responseData);
    }

    // 2. Check if ANY game is currently running in this room
    // Failsafe: a real bingo game lasts at most ~20 minutes (75 balls * ~10s + padding)
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
    const runningGame = await prisma.game.findFirst({
      where: { 
        roomId: room.id, 
        status: 'RUNNING',
        startedAt: { gte: twentyMinutesAgo }
      }
    });
    if (runningGame) {
      isGameRunning = true;
    } else {
      // Auto-heal: find any ghost RUNNING game older than 20 minutes and force-finish it
      const ghostGame = await prisma.game.findFirst({
        where: { roomId: room.id, status: 'RUNNING', startedAt: { lt: twentyMinutesAgo } }
      });
      if (ghostGame) {
        await prisma.game.update({
          where: { id: ghostGame.id },
          data: { status: 'FINISHED', finishedAt: new Date() }
        }).catch(() => {}); // silent — best effort
        // Clear cache so the fix is visible immediately
        for (const k of Array.from(occupiedCache.keys())) {
          if (k.startsWith(type)) occupiedCache.delete(k);
        }
        logger.warn(`[OccupiedCards] Auto-healed ghost RUNNING game ${ghostGame.id} for room ${type}`);
      }
    }

    let hasTicketsInRunningGame = false;
    let runningGameId: string | null = null;
    if (runningGame) {
      runningGameId = runningGame.id; // Always return so frontend can join socket for live calls
      if (user?.id) {
        const userRunningTickets = await prisma.ticket.count({
          where: { gameId: runningGame.id, userId: user.id }
        });
        if (userRunningTickets > 0) {
          hasTicketsInRunningGame = true;
        }
      }
    }

    let drawnNumbers: number[] = [];
    if (runningGame) {
      // 1. Try in-memory first (fastest)
      const { getActiveGames } = await import('../game/engine');
      const memState = getActiveGames().get(runningGame.id);
      if (memState && memState.drawnNumbers && memState.drawnNumbers.length > 0) {
        drawnNumbers = memState.drawnNumbers;
      } else {
        // 2. Fallback to DB drawHistory (works after server restart)
        const history = await prisma.drawHistory.findMany({
          where: { gameId: runningGame.id },
          orderBy: { createdAt: 'asc' },
          select: { number: true },
        });
        drawnNumbers = history.map(h => h.number);
      }
    }

    // 3. Resolve the active/waiting game ID
    if (gameIdFromQuery) {
      // Check if the requested game is RUNNING
      const requestedGame = await prisma.game.findUnique({ where: { id: gameIdFromQuery }, select: { status: true, roomId: true } });
      if (requestedGame && (requestedGame.status === 'RUNNING' || requestedGame.status === 'FINISHED')) {
        // Find the next WAITING game for this room
        const nextWaiting = await prisma.game.findFirst({
          where: { roomId: requestedGame.roomId, status: 'WAITING' },
          orderBy: { createdAt: 'desc' },
        });
        gameId = nextWaiting?.id;
        // ONLY auto-create if no game is running
        if (!gameId && !isGameRunning) {
          const { createWaitingGame } = await import('../game/engine');
          gameId = await createWaitingGame(requestedGame.roomId);
        }
      } else {
        gameId = gameIdFromQuery;
      }
    } else {
      // Find the active WAITING or COUNTDOWN game
      const activeGame = await prisma.game.findFirst({
        where: { roomId: room.id, status: { in: ['WAITING', 'COUNTDOWN'] } },
        orderBy: { createdAt: 'desc' },
      });
      gameId = activeGame?.id;
      // ONLY auto-create if no game is running
      if (!gameId && !isGameRunning) {
        const { createWaitingGame } = await import('../game/engine');
        gameId = await createWaitingGame(room.id);
      }
    }
    
    if (!gameId) {
      const responseData = { 
        occupiedIds: [], 
        myCardIds: [], 
        isGameRunning: isGameRunning,
        hasTicketsInRunningGame,
        runningGameId,
        drawnNumbers
      };
      occupiedCache.set(cacheKey, { data: responseData, timestamp: now });
      return res.json(responseData);
    }

    const tickets = await prisma.ticket.findMany({
      where: { gameId },
      select: { card: true, userId: true, user: { select: { isBot: true } } }
    });

    const myCardIds = user ? tickets.filter(t => t.userId === user.id).map(t => (t.card as any).id) : [];
    const otherOccupiedIds = user 
      ? tickets.filter(t => t.userId !== user.id).map(t => (t.card as any).id) 
      : tickets.map(t => (t.card as any).id);

    const realUserIds = new Set(tickets.filter(t => !t.user?.isBot).map(t => t.userId));
    const botUserIds = new Set(tickets.filter(t => t.user?.isBot).map(t => t.userId));
    const playerCount = realUserIds.size + botUserIds.size;
    
    const { getVisibleTickets } = await import('../game/engine');
    const { getVisibleBotCount } = await import('../services/houseBot.service');
    const { getReservedCardIds } = await import('../lib/cardReservations');

    // visibleTicketCount matches the count used in recalculateGamePrizePool so
    // the PLAYERS display and PRIZE pool are always in sync.
    const visibleTickets = getVisibleTickets(tickets, room.type);
    const visibleTicketCount = visibleTickets.length;

    const reservedByOthers = gameId ? getReservedCardIds(gameId, user?.id) : [];
    const allOccupiedIds = Array.from(new Set([...otherOccupiedIds, ...reservedByOthers]));
    
    const responseData = { 
      occupiedIds: allOccupiedIds, 
      myCardIds, 
      gameId, 
      roomId: room.id, 
      playerCount,
      ticketCount: tickets.length,
      visibleTicketCount,          // ← matches prize pool calculation
      realPlayerCount: realUserIds.size,
      botPlayerCount: botUserIds.size,
      expectedBotCount: getVisibleBotCount(room.type),  // ← cyclical cap for this game
      isGameRunning,
      hasTicketsInRunningGame,
      runningGameId,
      gameStartedAt: isGameRunning && runningGame?.startedAt ? runningGame.startedAt.getTime() : undefined,
      drawnNumbers
    };

    occupiedCache.set(cacheKey, { data: responseData, timestamp: now });
    res.json(responseData);
  } catch (e: any) {
    logger.error('Failed to fetch occupied cards:', e);
    res.status(500).json({ error: 'Failed to fetch occupied cards' });
  }
});

router.post('/games/:gameId/bingo', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { gameId } = req.params;
  
  try {
    const { claimBingoWin } = await import('../game/engine');
    const result = await claimBingoWin(gameId, user.id);
    
    res.json(result);
  } catch (err: any) {
    logger.error('Bingo claim failed:', err);
    res.status(400).json({ error: err.message || 'Verification failed' });
  }
});



router.get('/games/:gameId', async (req: Request, res: Response) => {
  const game = await prisma.game.findUnique({
    where: { id: req.params.gameId },
    include: {
      room: true,
      drawHistory: { orderBy: { sequence: 'asc' } },
      winners: {
        orderBy: { id: 'asc' },
        include: {
          user: { select: { firstName: true, telegramUsername: true, isBot: true, telegramId: true } },
          ticket: { select: { card: true } }
        }
      },
      _count: { select: { tickets: true } },
    },
  });
  if (!game) return res.status(404).json({ error: 'Game not found' });
  
  // Inject live state if available
  const { getActiveGames } = await import('../game/engine');
  const activeGames = getActiveGames();
  const state = activeGames.get(game.id);
  
  const { _count, ...gameData } = game as any;
  
  // Apply the same aggressive card reconstruction as engine.ts
  const { PREDEFINED_CARDS } = await import('../lib/predefinedCards');
  if (gameData.winners) {
    for (const w of gameData.winners) {
      let resolvedCard: any = w.ticket?.card ?? null;
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

      // Ensure PREDEFINED_CARDS fallback always picks a valid index (1–250)
      if (!cardRows || cardRows.length === 0) {
        let fallbackId = 1;
        if (cardId && cardId >= 1 && cardId <= 250 && PREDEFINED_CARDS[cardId]) {
          fallbackId = cardId;
        } else {
          let cardHash = 0;
          const cardSeed = String(w.ticketId); // MUST match engine.ts exactly
          for (let i = 0; i < cardSeed.length; i++) {
            cardHash = cardSeed.charCodeAt(i) + ((cardHash << 5) - cardHash);
          }
          fallbackId = (Math.abs(cardHash) % 250) + 1;
        }
        
        const pattern = PREDEFINED_CARDS[fallbackId];
        if (pattern) {
          cardRows = pattern.map((row: number[]) =>
            row.map((cell: number) => (cell === 0 ? 'FREE' : cell))
          );
          cardId = fallbackId;
        }
      }

      w.card = { id: cardId, rows: cardRows };
      w.cardId = cardId || w.card?.id;
      // Expose isBot + telegramId at top level so frontend can identify current user
      w.isBot = w.user?.isBot ?? false;
      w.telegramId = w.user?.telegramId ? String(w.user.telegramId) : null;
      
      const realName = w.user?.firstName || w.user?.telegramUsername;
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
      let nameHash = 0;
      // MUST match engine.ts exactly: String(game.id) + String(w.ticketId)
      // Do not add fallbacks like || w.id because engine.ts does not.
      const nameSeed = String(game.id) + String(w.ticketId);
      for (let i = 0; i < nameSeed.length; i++) {
        nameHash = nameSeed.charCodeAt(i) + ((nameHash << 5) - nameHash);
      }
      const botName = ETHIOPIAN_NAMES[Math.abs(nameHash) % ETHIOPIAN_NAMES.length];
      const displayName = w.isBot ? botName : (realName || 'Player');
      
      w.displayName = displayName;
      if (w.user) {
        w.user.firstName = displayName;
        w.user.telegramUsername = w.isBot ? displayName.toLowerCase() : (w.user.telegramUsername || displayName.toLowerCase());
      }
    }
  }
  // Calculate true unique player count
  const uniqueUsers = await prisma.ticket.findMany({ where: { gameId: game.id }, select: { userId: true }, distinct: ['userId'] });
  const pCount = uniqueUsers.length;

  // Calculate visible ticket count (same cap used in prize pool calc)
  const allTixForVis = await prisma.ticket.findMany({ where: { gameId: game.id }, select: { userId: true, user: { select: { isBot: true } } } });
  const { getVisibleTickets } = await import('../game/engine');
  const visibleTicketCountForGame = getVisibleTickets(allTixForVis, game.room.type).length;

  res.json({
    ...gameData,
    countdownSeconds: state?.secondsRemaining ?? gameData.countdownSeconds,
    playerCount: pCount,
    ticketCount: _count.tickets,
    visibleTicketCount: visibleTicketCountForGame,   // ← matches prize pool
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
        select: { firstName: true, telegramId: true, telegramUsername: true, isBot: true }
      });
      
      const rawTgId = user?.telegramId?.toString() || '0000000000';
      const obfuscated = rawTgId.length > 5 
        ? rawTgId.slice(0, 5) + '**' + rawTgId.slice(-3) 
        : rawTgId;

      let displayName = user?.telegramUsername || user?.firstName || 'Buna Player';
      if (user?.isBot) {
        // MUST match the 24-name array in backend/src/game/engine.ts
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
        let nameHash = 0;
        const nameSeed = String(w.userId);
        for (let i = 0; i < nameSeed.length; i++) {
          nameHash = nameSeed.charCodeAt(i) + ((nameHash << 5) - nameHash);
        }
        displayName = ETHIOPIAN_NAMES[Math.abs(nameHash) % ETHIOPIAN_NAMES.length];
      }

      return {
        id: w.userId,
        name: displayName,
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

// ─── Staff + Admin Routes ────────────────────────────────────
const staffMiddleware = async (req: Request, res: Response, next: any) => {
  const { staffMiddleware: mw } = await import('../middleware/auth');
  mw(req, res, next);
};


staffRouter.get('/deposits/pending', async (req, res) => {
  const admin = (req as any).user;
  const agentId = (admin.isAdmin || admin.role === 'ADMIN') ? undefined : admin.id;
  res.json(await getPendingDeposits(agentId));
});
staffRouter.post('/deposits/:id/approve', async (req, res) => {
  const admin = (req as any).user;
  if (admin.role === 'STAFF') return res.status(403).json({ error: 'STAFF users are read-only.' });
  try {
    await approveDeposit(req.params.id, admin.id);
    await logAdminAction(admin.id, 'APPROVE_DEPOSIT', null, { depositId: req.params.id });
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
staffRouter.post('/deposits/:id/reject', async (req, res) => {
  const admin = (req as any).user;
  if (admin.role === 'STAFF') return res.status(403).json({ error: 'STAFF users are read-only.' });
  try {
    await rejectDeposit(req.params.id, admin.id, req.body.reason || 'Rejected');
    await logAdminAction(admin.id, 'REJECT_DEPOSIT', null, { depositId: req.params.id, reason: req.body.reason || 'Rejected' });
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

staffRouter.get('/withdrawals/pending', async (req, res) => {
  const admin = (req as any).user;
  const agentId = (admin.isAdmin || admin.role === 'ADMIN') ? undefined : admin.id;
  res.json(await getPendingWithdrawals(agentId));
});

// ─── Deposit History (all statuses) ─────────────────────────────────────────
staffRouter.get('/deposits/history', async (req, res) => {
  const admin = (req as any).user;
  const page = parseInt(req.query.page as string) || 1;
  const limit = 50;
  const skip = (page - 1) * limit;
  const agentId = (admin.isAdmin || admin.role === 'ADMIN') ? undefined : admin.id;

  const where: any = agentId ? { user: { referredBy: agentId } } : {};

  try {
    const [deposits, total] = await Promise.all([
      prisma.deposit.findMany({
        where,
        include: {
          user: {
            select: { firstName: true, telegramId: true, telegramUsername: true, username: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.deposit.count({ where }),
    ]);
    res.json({ deposits, total, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Withdrawal History (all statuses) ──────────────────────────────────────
staffRouter.get('/withdrawals/history', async (req, res) => {
  const admin = (req as any).user;
  const page = parseInt(req.query.page as string) || 1;
  const limit = 50;
  const skip = (page - 1) * limit;
  const agentId = (admin.isAdmin || admin.role === 'ADMIN') ? undefined : admin.id;

  const where: any = agentId ? { user: { referredBy: agentId } } : {};

  try {
    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where,
        include: {
          user: {
            select: { firstName: true, telegramId: true, telegramUsername: true, username: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.withdrawal.count({ where }),
    ]);
    res.json({ withdrawals, total, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
staffRouter.post('/withdrawals/:id/approve', async (req, res) => {
  const admin = (req as any).user;
  if (admin.role === 'STAFF') return res.status(403).json({ error: 'STAFF users are read-only.' });
  try {
    await approveWithdrawal(req.params.id, admin.id);
    await logAdminAction(admin.id, 'APPROVE_WITHDRAWAL', null, { withdrawalId: req.params.id });
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
staffRouter.post('/withdrawals/:id/reject', async (req, res) => {
  const admin = (req as any).user;
  if (admin.role === 'STAFF') return res.status(403).json({ error: 'STAFF users are read-only.' });
  try {
    await rejectWithdrawal(req.params.id, admin.id, req.body.reason || 'Rejected');
    await logAdminAction(admin.id, 'REJECT_WITHDRAWAL', null, { withdrawalId: req.params.id, reason: req.body.reason || 'Rejected' });
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

staffRouter.get('/transactions/summary', async (req, res) => {
  const user = (req as any).user;
  
  let userFilter: any = {};
  if (user.role === 'STAFF') {
    const assigned = Array.isArray(user.depositPhones) ? user.depositPhones : [];
    if (assigned.length > 0) {
      userFilter = { referredBy: { in: assigned } };
    } else {
      userFilter = { referredBy: '00000000-0000-0000-0000-000000000000' };
    }
  } else if (!user.isAdmin && user.role !== 'ADMIN') {
    userFilter = { referredBy: user.id };
  }

  const txUserFilter = Object.keys(userFilter).length > 0 ? { user: { isBot: false, ...userFilter } } : { user: { isBot: false } };
  const walletUserFilter = Object.keys(userFilter).length > 0 ? { user: { isBot: false, ...userFilter } } : { user: { isBot: false } };

  try {
    const [
      pendingDeps,
      pendingWds,
      approvedDepsAgg,
      completedWdsAgg,
      bonusCreditsAgg,
      prizeWinningsAgg,
      referralBonusAgg,
      ticketPurchasesAgg,
      totalWalletAgg,
    ] = await Promise.all([
      prisma.deposit.aggregate({
        where: { status: { in: ['pending', 'PENDING'] }, ...txUserFilter },
        _sum: { amount: true },
        _count: { id: true }
      }),
      prisma.withdrawal.aggregate({
        where: { status: { in: ['pending', 'PENDING'] }, ...txUserFilter },
        _sum: { amount: true },
        _count: { id: true }
      }),
      prisma.deposit.aggregate({
        where: { status: { in: ['approved', 'completed', 'APPROVED', 'COMPLETED'] }, ...txUserFilter },
        _sum: { amount: true }
      }),
      prisma.withdrawal.aggregate({
        where: { status: { in: ['approved', 'completed', 'APPROVED', 'COMPLETED'] }, ...txUserFilter },
        _sum: { amount: true }
      }),
      // Bonus credits (deposit bonus — DEPOSIT type but description contains 'bonus')
      prisma.transaction.aggregate({
        where: { type: 'DEPOSIT', description: { contains: 'bonus' }, ...txUserFilter },
        _sum: { amount: true }
      }),
      // Real prize wins
      prisma.transaction.aggregate({
        where: { type: 'PRIZE_WIN', status: { in: ['completed', 'COMPLETED'] }, ...txUserFilter },
        _sum: { amount: true }
      }),
      // Referral bonuses
      prisma.transaction.aggregate({
        where: { type: 'REFERRAL_BONUS', ...txUserFilter },
        _sum: { amount: true }
      }),
      // Ticket purchases (money spent on tickets)
      prisma.transaction.aggregate({
        where: { type: 'TICKET_PURCHASE', status: { in: ['completed', 'COMPLETED'] }, ...txUserFilter },
        _sum: { amount: true, balanceBefore: true, balanceAfter: true }
      }),
      // Current total wallet balances across all real players
      prisma.wallet.aggregate({
        where: walletUserFilter,
        _sum: { balance: true }
      }),
    ]);

    const totalDeposited    = Number(approvedDepsAgg._sum.amount || 0);
    const totalWithdrawn    = Number(completedWdsAgg._sum.amount || 0);
    const bonusCredits      = Number(bonusCreditsAgg._sum.amount || 0);
    const prizeWinnings     = Number(prizeWinningsAgg._sum.amount || 0);
    const referralBonuses   = Number(referralBonusAgg._sum.amount || 0);
    const ticketsPurchased  = Number(ticketPurchasesAgg._sum.balanceBefore || 0) - Number(ticketPurchasesAgg._sum.balanceAfter || 0);
    const totalWalletBalance = Number(totalWalletAgg._sum.balance || 0);

    res.json({
      pendingDepositsCount: pendingDeps._count.id || 0,
      pendingDepositsSum: Number(pendingDeps._sum.amount || 0),
      pendingWithdrawalsCount: pendingWds._count.id || 0,
      pendingWithdrawalsSum: Number(pendingWds._sum.amount || 0),
      // Cash flow
      totalDeposited,
      totalWithdrawn,
      // Wallet credits breakdown
      bonusCredits,
      prizeWinnings,
      referralBonuses,
      ticketsPurchased,
      totalWalletBalance,
      // Formula: Deposit + Bonus + Prizes + Referral - Tickets - Withdrawals = Balance
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

staffRouter.get('/transactions', async (req, res) => {
  const user = (req as any).user;
  const page = parseInt(req.query.page as string) || 1;
  const limit = 50;
  const skip = (page - 1) * limit;

  const whereClause: any = {};
  if (!user.isAdmin && user.role !== 'ADMIN') {
    whereClause.user = { referredBy: user.id };
  }

  try {
    const [txns, total] = await Promise.all([
      prisma.transaction.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              telegramId: true,
              telegramUsername: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where: whereClause })
    ]);

    res.json({
      transactions: txns,
      total,
      pages: Math.ceil(total / limit)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

staffRouter.get('/users', async (req, res) => {
  const user = (req as any).user;
  const page = parseInt(req.query.page as string) || 1;
  const search = (req.query.search as string) || '';
  const referredByFilter = (req.query.referredBy as string) || '';
  const limit = parseInt(req.query.limit as string) || 20;

  try {
    if (user.isAdmin || user.role === 'ADMIN') {
      if (referredByFilter === 'unassigned') {
        // Show players with no agent assigned
        const { getPlayersUnderAgent } = await import('../services/user.service');
        const skip = (page - 1) * limit;
        const where: any = { referredBy: null, isBot: false };
        if (search) {
          where.OR = [
            { firstName: { contains: search, mode: 'insensitive' } },
            { telegramUsername: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ];
        }
        const [users, total] = await Promise.all([
          prisma.user.findMany({ where, skip, take: limit, include: { wallet: true, referrer: { select: { id: true, firstName: true, telegramUsername: true, referralCode: true, role: true } } }, orderBy: { createdAt: 'desc' } }),
          prisma.user.count({ where }),
        ]);
        res.json({ users, total, pages: Math.ceil(total / limit) });
      } else if (referredByFilter) {
        const { getPlayersUnderAgent } = await import('../services/user.service');
        res.json(await getPlayersUnderAgent(referredByFilter, page, limit, search));
      } else {
        res.json(await getAllUsers(page, limit, search));
      }
    } else {
      const { getPlayersUnderAgent } = await import('../services/user.service');
      res.json(await getPlayersUnderAgent(user.id, page, limit, search));
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
staffRouter.post('/users/:id/suspend', async (req, res) => {
  const admin = (req as any).user;
  await suspendUser(req.params.id, admin.id, req.body.reason || '');
  await logAdminAction(admin.id, 'SUSPEND_USER', req.params.id, { reason: req.body.reason || '' });
  res.json({ success: true });
});
staffRouter.post('/users/:id/ban', async (req, res) => {
  const admin = (req as any).user;
  await banUser(req.params.id, admin.id, req.body.reason || '');
  await logAdminAction(admin.id, 'BAN_USER', req.params.id, { reason: req.body.reason || '' });
  res.json({ success: true });
});
staffRouter.post('/users/:id/unban', async (req, res) => {
  const admin = (req as any).user;
  await prisma.user.update({ where: { id: req.params.id }, data: { status: 'ACTIVE' } });
  await logAdminAction(admin.id, 'UNBAN_USER', req.params.id);
  res.json({ success: true });
});

// ─── Admin/Staff Management ──────────────────────────────────
staffRouter.get('/agents', staffMiddleware, async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const admin = (req as any).user;
  let agentIds: string[] | undefined = undefined;

  if (admin.role === 'STAFF') {
    const assigned = Array.isArray(admin.depositPhones) ? admin.depositPhones : [];
    agentIds = assigned;
    if (agentIds.length === 0) {
      agentIds = ['00000000-0000-0000-0000-000000000000'];
    }
  }

  const { getAgents } = await import('../services/user.service');
  res.json(await getAgents(page, 20, agentIds));
});

// ─── Company Profit Summary (All Agents) ────────────────────
staffRouter.get('/company-profit', staffMiddleware, async (req, res) => {
  try {
    const { getAgentProfitRate, getCompanyCommissionRate } = await import('../services/settings.service');
    const [profitRate, companyRate] = await Promise.all([getAgentProfitRate(), getCompanyCommissionRate()]);

    // Date filter
    let dateFilter: any = {};
    const range = req.query.range as string;
    
    // We will build a per-agent date filter if range === 'current_period'
    if (range === 'today') {
      const start = new Date(); start.setHours(0,0,0,0);
      dateFilter = { createdAt: { gte: start } };
    } else if (range === 'week') {
      const start = new Date(); start.setDate(start.getDate() - 7); start.setHours(0,0,0,0);
      dateFilter = { createdAt: { gte: start } };
    } else if (range === 'month') {
      const start = new Date(); start.setDate(start.getDate() - 30); start.setHours(0,0,0,0);
      dateFilter = { createdAt: { gte: start } };
    }

    // Get all agents
    const agents = await prisma.user.findMany({
      where: { role: { in: ['AGENT', 'ADMIN'] } },
      include: {
        referrals: { select: { id: true, isBot: true } },
        agentPreDepositWallet: true,
        agentSettlements: {
          orderBy: { periodEnd: 'desc' },
          take: 2, // take 2 so we can surface lastCollectedAt
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    // NCF Split: If agent takes 6% of ticket sales and house edge is 30%, their NCF share is 6/30 = 20%
    const AGENT_RATE = companyRate > 0 ? profitRate / companyRate : 0.20;
    const COMPANY_RATE = Math.max(0, 1 - AGENT_RATE);

    const { getBranchPlayerIds } = await import('../services/user.service');

    const agentRows = await Promise.all(agents.map(async (agent) => {
      const realPlayerIds = await getBranchPlayerIds(agent.id);
      // Sum of all past settlements = total physically collected ever
      const allSettlementsAgg = await prisma.agentSettlement.aggregate({
        where: { agentId: agent.id },
        _sum: { amount: true },
      });
      const totalCollected = Number(allSettlementsAgg._sum.amount || 0);
      const lastCollectedAt = agent.agentSettlements?.[0]?.periodEnd ?? null;

      if (realPlayerIds.length === 0) {
        return {
          agentId: agent.id,
          agentName: agent.firstName || 'Unknown',
          agentUsername: agent.telegramUsername || '',
          referralCode: agent.referralCode || '',
          totalTicketSales: 0,
          companyShare: 0,
          agentEarned: 0,
          botDebtAdded: 0,
          botDebtSettled: 0,
          outstandingBotDebt: 0,
          totalDeposited: 0,
          totalWithdrawn: 0,
          netCashFlow: 0,
          preDepositBalance: Number(agent.agentPreDepositWallet?.balance || 0),
          realPlayersCount: 0,
          totalCollected,
          lastCollectedAt,
        };
      }

      let agentDateFilter = { ...dateFilter };
      
      // If current_period, filter starting from the last settlement's periodEnd
      if (range === 'current_period') {
        const lastSettlement = agent.agentSettlements?.[0];
        if (lastSettlement) {
          agentDateFilter = { createdAt: { gt: lastSettlement.periodEnd } };
        } else {
          // If they've never been settled, 'current_period' is effectively 'all time'
          agentDateFilter = {}; 
        }
      }

      const [ticketSalesAgg, depositsAgg, withdrawalsAgg, botDebtAddedAgg, botDebtSettledAgg] = await Promise.all([
        prisma.transaction.aggregate({
          where: { type: 'TICKET_PURCHASE', status: { in: ['completed', 'COMPLETED'] }, userId: { in: realPlayerIds }, ...agentDateFilter },
          // Use balanceBefore/After to compute real cash sales (excluding bonus ETB)
          _sum: { amount: true, balanceBefore: true, balanceAfter: true },
        }),
        prisma.deposit.aggregate({
          where: { status: { in: ['APPROVED', 'approved', 'COMPLETED', 'completed'] }, userId: { in: realPlayerIds }, ...agentDateFilter },
          _sum: { amount: true },
        }),
        prisma.withdrawal.aggregate({
          where: { status: { in: ['APPROVED', 'COMPLETED', 'approved', 'completed'] }, userId: { in: realPlayerIds }, ...agentDateFilter },
          _sum: { amount: true },
        }),
        prisma.agentCommissionLog.aggregate({
          where: { agentId: agent.id, type: 'BOT_WIN_DEBT_ADDED', ...agentDateFilter },
          _sum: { amount: true },
        }),
        prisma.agentCommissionLog.aggregate({
          where: { agentId: agent.id, type: 'BOT_WIN_DEBT_SETTLED', ...agentDateFilter },
          _sum: { amount: true },
        }),
      ]);

      // Real cash spent on tickets only (excludes bonus ETB)
      const totalTicketSales = Number(ticketSalesAgg._sum.balanceBefore || 0) - Number(ticketSalesAgg._sum.balanceAfter || 0);
      const totalDeposited = Number(depositsAgg._sum.amount || 0);
      const totalWithdrawn = Number(withdrawalsAgg._sum.amount || 0);
      const botDebtAdded = Number(botDebtAddedAgg._sum.amount || 0);
      const botDebtSettled = Number(botDebtSettledAgg._sum.amount || 0);

      const netCashFlow = Math.max(0, totalDeposited - totalWithdrawn);
      // Salaried Employee Override: @Luel1616 (Buna Bingo Support) earns 0% commission
      const actualAgentRate = agent.id === 'd1d93520-0c1a-4403-bf0c-f2f162a1dd36' ? 0 : AGENT_RATE;
      const agentEarned = netCashFlow * actualAgentRate;
      const companyShare = netCashFlow - agentEarned;
      return {
        agentId: agent.id,
        agentName: agent.firstName || 'Unknown',
        agentUsername: agent.telegramUsername || '',
        referralCode: agent.referralCode || '',
        totalTicketSales,
        companyShare,
        agentEarned,
        botDebtAdded,
        botDebtSettled,
        outstandingBotDebt: Math.max(0, botDebtAdded - botDebtSettled),
        totalDeposited,
        totalWithdrawn,
        netCashFlow: totalDeposited - totalWithdrawn,
        preDepositBalance: Number(agent.agentPreDepositWallet?.balance || 0),
        realPlayersCount: realPlayerIds.length,
        totalCollected,
        lastCollectedAt,
      };
    }));

    // Totals
    const totals = agentRows.reduce((acc, row) => ({
      totalTicketSales: acc.totalTicketSales + row.totalTicketSales,
      companyShare: acc.companyShare + row.companyShare,
      agentEarned: acc.agentEarned + row.agentEarned,
      botDebtAdded: acc.botDebtAdded + row.botDebtAdded,
      botDebtSettled: acc.botDebtSettled + row.botDebtSettled,
      outstandingBotDebt: acc.outstandingBotDebt + row.outstandingBotDebt,
      totalDeposited: acc.totalDeposited + row.totalDeposited,
      totalWithdrawn: acc.totalWithdrawn + row.totalWithdrawn,
      netCashFlow: acc.netCashFlow + row.netCashFlow,
    }), {
      totalTicketSales: 0, companyShare: 0, agentEarned: 0,
      botDebtAdded: 0, botDebtSettled: 0, outstandingBotDebt: 0,
      totalDeposited: 0, totalWithdrawn: 0, netCashFlow: 0,
    });

    // Get global totals for real players in the same date range
    const [globalSalesAgg, globalDepositsAgg, globalWithdrawalsAgg] = await Promise.all([
      prisma.transaction.aggregate({
        where: { type: 'TICKET_PURCHASE', status: { in: ['completed', 'COMPLETED'] }, user: { isBot: false }, ...dateFilter },
        _sum: { amount: true, balanceBefore: true, balanceAfter: true }
      }),
      prisma.deposit.aggregate({
        where: { status: { in: ['APPROVED', 'approved', 'COMPLETED', 'completed'] }, user: { isBot: false }, ...dateFilter },
        _sum: { amount: true }
      }),
      prisma.withdrawal.aggregate({
        where: { status: { in: ['APPROVED', 'COMPLETED', 'approved', 'completed'] }, user: { isBot: false }, ...dateFilter },
        _sum: { amount: true }
      })
    ]);

    const globalSales = Number(globalSalesAgg._sum.balanceBefore || 0) - Number(globalSalesAgg._sum.balanceAfter || 0);
    const globalDeposits = Number(globalDepositsAgg._sum.amount || 0);
    const globalWithdrawals = Number(globalWithdrawalsAgg._sum.amount || 0);

    const unreferredSales = Math.max(0, globalSales - totals.totalTicketSales);
    const unreferredDeposits = Math.max(0, globalDeposits - totals.totalDeposited);
    const unreferredWithdrawals = Math.max(0, globalWithdrawals - totals.totalWithdrawn);
    const unreferredNCF = Math.max(0, unreferredDeposits - unreferredWithdrawals);

    // System row (Direct to Company) removed per request.

    res.json({
      range: range || 'all',
      companyRate: COMPANY_RATE,
      agentRate: AGENT_RATE,
      totals,
      agents: agentRows.filter(r => r.totalTicketSales > 0 || r.totalDeposited > 0).sort((a, b) => b.companyShare - a.companyShare),
    });
  } catch (err: any) {
    logger.error('[Company Profit]', err);
    res.status(500).json({ error: err.message || 'Failed to load company profit summary' });
  }
});

// ─── Single Agent Detailed Report ───────────────────────────
staffRouter.get('/agents/:id/report', staffMiddleware, async (req, res) => {
  try {
    const admin = (req as any).user;
    const agentId = req.params.id;

    if (admin.role === 'STAFF') {
      const assigned = Array.isArray(admin.depositPhones) ? admin.depositPhones : [];
      if (!assigned.includes(agentId)) {
        return res.status(403).json({ error: 'You are not assigned to this agent' });
      }
    }

    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      include: {
        wallet: true,
        agentPreDepositWallet: true,
        referrals: {
          select: {
            id: true,
            firstName: true,
            telegramUsername: true,
            telegramId: true,
            phone: true,
            status: true,
            isBot: true,
            createdAt: true,
            wallet: { select: { balance: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (agent.role !== 'AGENT' && agent.role !== 'ADMIN') {
      return res.status(404).json({ error: 'User is not a staff member' });
    }

    // Fetch branch players (nested referrals, but stopping at sub-agents)
    const { getBranchPlayerIds } = await import('../services/user.service');
    const branchPlayerIds = await getBranchPlayerIds(agentId);
    
    const descendantUsers = await prisma.user.findMany({
      where: { id: { in: branchPlayerIds.length > 0 ? branchPlayerIds : ['00000000-0000-0000-0000-000000000000'] } },
      select: { id: true, isBot: true, firstName: true, telegramUsername: true }
    });

    // Only real (non-bot) referred users
    const referredUserIds = descendantUsers.map((r: any) => r.id);
    const realPlayers = descendantUsers;
    const botPlayers = []; // Branch query already excludes bots

    const { getAgentProfitRate, getCompanyCommissionRate } = await import('../services/settings.service');
    const { getAgentPreDepositStatus } = await import('../services/agentPreDeposit.service');

    let dateFilter: any = {};
    let range = req.query.range as string;
    
    if (range === 'current_period') {
      const lastSettlement = await prisma.agentSettlement.findFirst({
        where: { agentId },
        orderBy: { periodEnd: 'desc' }
      });
      if (lastSettlement) {
        dateFilter = { createdAt: { gt: lastSettlement.periodEnd } };
      }
    } else if (range === 'today') {
      const start = new Date(); start.setHours(0,0,0,0);
      dateFilter = { createdAt: { gte: start } };
    } else if (range === 'week') {
      const start = new Date(); start.setDate(start.getDate() - 7); start.setHours(0,0,0,0);
      dateFilter = { createdAt: { gte: start } };
    } else if (range === 'month') {
      const start = new Date(); start.setDate(start.getDate() - 30); start.setHours(0,0,0,0);
      dateFilter = { createdAt: { gte: start } };
    }

    const [
      profitRate,
      companyRate,
      preDepositStatus,
      totalDepositsAgg,
      pendingDepositsAgg,
      totalTicketSalesAgg,
      totalWithdrawalsAgg,
      pendingWithdrawalsAgg,
      realPlayerPrizesAgg,
      rechargeHistory,
      commissionDebitsAgg,
      commissionDebits,
      topDepositPlayers,
      recentDeposits,
      recentTransactions,
      gameCount,
      winnerCount,
      botDebtAddedAgg,
      botDebtSettledAgg,
    ] = await Promise.all([
      getAgentProfitRate(),
      getCompanyCommissionRate(),
      getAgentPreDepositStatus(agentId),

      prisma.deposit.aggregate({
        where: { status: { in: ['APPROVED', 'approved', 'COMPLETED', 'completed'] }, userId: { in: referredUserIds }, ...dateFilter },
        _sum: { amount: true }, _count: { id: true },
      }),
      prisma.deposit.aggregate({
        where: { status: { in: ['PENDING', 'pending'] }, userId: { in: referredUserIds }, ...dateFilter },
        _sum: { amount: true }, _count: { id: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'TICKET_PURCHASE', status: { in: ['completed', 'COMPLETED'] }, userId: { in: referredUserIds }, ...dateFilter },
        // Use balanceBefore/After to compute real cash only (excludes bonus ETB)
        _sum: { amount: true, balanceBefore: true, balanceAfter: true }, _count: { id: true },
      }),
      prisma.withdrawal.aggregate({
        where: { status: { in: ['APPROVED', 'COMPLETED', 'approved', 'completed'] }, userId: { in: referredUserIds }, ...dateFilter },
        _sum: { amount: true }, _count: { id: true },
      }),
      prisma.withdrawal.aggregate({
        where: { status: { in: ['PENDING', 'pending'] }, userId: { in: referredUserIds }, ...dateFilter },
        _sum: { amount: true }, _count: { id: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'PRIZE_WIN', status: { in: ['completed', 'COMPLETED'] }, userId: { in: referredUserIds }, ...dateFilter },
        _sum: { amount: true }, _count: { id: true },
      }),
      prisma.agentCommissionLog.findMany({
        where: { agentId, type: 'RECHARGE', ...dateFilter },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true, amount: true, createdAt: true, description: true }
      }),
      prisma.agentCommissionLog.aggregate({
        where: { agentId, type: 'COMMISSION_DEBIT', ...dateFilter },
        _sum: { amount: true }, _count: { id: true },
      }),
      prisma.agentCommissionLog.findMany({
        where: { agentId, type: 'COMMISSION_DEBIT', ...dateFilter },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, amount: true, createdAt: true, description: true }
      }),
      prisma.deposit.groupBy({
        by: ['userId'],
        where: { status: { in: ['APPROVED', 'approved', 'COMPLETED', 'completed'] }, userId: { in: referredUserIds }, ...dateFilter },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),
      prisma.deposit.findMany({
        where: { userId: { in: referredUserIds }, ...dateFilter },
        include: { user: { select: { firstName: true, telegramUsername: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.transaction.findMany({
        where: { userId: { in: referredUserIds }, ...dateFilter },
        include: { user: { select: { firstName: true, telegramUsername: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.game.count({
        where: { tickets: { some: { userId: { in: referredUserIds }, ...(dateFilter.createdAt ? { purchasedAt: dateFilter.createdAt } : {}) } } },
      }),
      prisma.winner.count({
        where: { userId: { in: referredUserIds }, ...(dateFilter.createdAt ? { paidAt: dateFilter.createdAt } : {}) },
      }),
      prisma.agentCommissionLog.aggregate({
        where: { agentId, type: 'BOT_WIN_DEBT_ADDED', ...dateFilter },
        _sum: { amount: true },
      }),
      prisma.agentCommissionLog.aggregate({
        where: { agentId, type: 'BOT_WIN_DEBT_SETTLED', ...dateFilter },
        _sum: { amount: true },
      }),
    ]);

    // Enrich top players with names
    const topPlayersEnriched = topDepositPlayers.map((p) => {
      const user = realPlayers.find((r: any) => r.id === p.userId) as any;
      return {
        userId: p.userId,
        name: user?.firstName || 'Unknown',
        username: user?.telegramUsername || '',
        totalDeposited: Number(p._sum.amount || 0),
      };
    });

    // Core financial calculations
    const totalDeposited     = Number(totalDepositsAgg._sum.amount || 0);
    // Real cash only — excludes bonus ETB spent on tickets
    const totalTicketSales   = Number(totalTicketSalesAgg._sum.balanceBefore || 0) - Number(totalTicketSalesAgg._sum.balanceAfter || 0);
    const totalWithdrawn     = Number(totalWithdrawalsAgg._sum.amount || 0);
    const totalPrizesWon     = Number(realPlayerPrizesAgg._sum.amount || 0);
    const pendingDeposits    = Number(pendingDepositsAgg._sum.amount || 0);
    const pendingWithdrawals = Number(pendingWithdrawalsAgg._sum.amount || 0);
    const preDepositWallet   = agent.agentPreDepositWallet;
    const preDepositBalance  = Number(preDepositWallet?.balance || 0);
    const preDepositRecharged = Number(preDepositWallet?.totalRecharged || 0);
    const preDepositDebited  = Number(preDepositWallet?.totalDebited || 0);
    const totalCommissionDeducted = Number(commissionDebitsAgg._sum.amount || 0);

    const botDebtAdded   = Number(botDebtAddedAgg._sum.amount || 0);
    const botDebtSettled = Number(botDebtSettledAgg._sum.amount || 0);
    const outstandingBotDebt = Math.max(0, botDebtAdded - botDebtSettled);

    // NCF Split: Agent gets profitRate/companyRate (e.g. 0.06/0.30 = 20%)
    const AGENT_RATE   = companyRate > 0 ? profitRate / companyRate : 0.20;
    const COMPANY_RATE = Math.max(0, 1 - AGENT_RATE);
    const netCashFlow = totalDeposited - totalWithdrawn;
    // Commission is now based on Net Cash Flow (not Gross Ticket Sales)
    // Agent gets their % of what was actually retained; company keeps the rest
    const netCashFlowForCalc = Math.max(0, netCashFlow); // never negative
    // Salaried Employee Override: @Luel1616 (Buna Bingo Support) earns 0% commission
    const actualAgentRate = agentId === 'd1d93520-0c1a-4403-bf0c-f2f162a1dd36' ? 0 : AGENT_RATE;
    const agentEarned             = netCashFlowForCalc * actualAgentRate;
    const companyEarnedFromBranch = netCashFlowForCalc - agentEarned;
    const totalCommissionExpected = netCashFlowForCalc * companyRate;
    const houseEdge   = totalTicketSales - totalPrizesWon;

    // Monthly 6-month trend
    const monthlyTrend: {month: string; deposits: number; ticketSales: number; agentProfit: number}[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const [mDep, mTickets, mWithdrawals] = await Promise.all([
        prisma.deposit.aggregate({
          where: { status: { in: ['APPROVED', 'approved', 'COMPLETED', 'completed'] }, userId: { in: referredUserIds }, createdAt: { gte: start, lte: end } },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { type: 'TICKET_PURCHASE', status: { in: ['completed', 'COMPLETED'] }, userId: { in: referredUserIds }, createdAt: { gte: start, lte: end } },
          _sum: { amount: true, balanceBefore: true, balanceAfter: true },
        }),
        prisma.withdrawal.aggregate({
          where: { status: { in: ['APPROVED', 'COMPLETED', 'approved', 'completed'] }, userId: { in: referredUserIds }, createdAt: { gte: start, lte: end } },
          _sum: { amount: true },
        }),
      ]);
      // Real cash only per month — excludes bonus ETB
      const mTicketAmount = Number(mTickets._sum.balanceBefore || 0) - Number(mTickets._sum.balanceAfter || 0);
      const mDeposited = Number(mDep._sum.amount || 0);
      const mWithdrawn = Number(mWithdrawals._sum.amount || 0);
      const mNetCashFlow = Math.max(0, mDeposited - mWithdrawn);
      monthlyTrend.push({
        month: label,
        deposits: mDeposited,
        ticketSales: mTicketAmount,
        agentProfit: mNetCashFlow * AGENT_RATE,
      });
    }

    // All-time collected & settlement history
    const [allTimeCollectedAgg, allSettlements] = await Promise.all([
      prisma.agentSettlement.aggregate({
        where: { agentId },
        _sum: { amount: true },
      }),
      prisma.agentSettlement.findMany({
        where: { agentId },
        orderBy: { periodEnd: 'desc' },
        take: 10,
        select: { id: true, amount: true, periodStart: true, periodEnd: true, notes: true, createdAt: true },
      }),
    ]);
    const allTimeCollected = Number(allTimeCollectedAgg._sum.amount || 0);
    const lastSettlementForPeriod = await prisma.agentSettlement.findFirst({
      where: { agentId },
      orderBy: { periodEnd: 'desc' },
    });
    const currentPeriodStart = lastSettlementForPeriod?.periodEnd ?? agent.createdAt;

    res.json({
      agent: {
        id: agent.id, firstName: agent.firstName,
        telegramUsername: agent.telegramUsername,
        telegramId: agent.telegramId, phone: agent.phone,
        role: agent.role, createdAt: agent.createdAt,
        depositPhones: agent.depositPhones,
        referralCode: agent.referralCode,
      },
      preDepositStatus,
      preDepositWallet: { balance: preDepositBalance, totalRecharged: preDepositRecharged, totalDebited: preDepositDebited },
      stats: {
        totalPlayers: referredUserIds.length,
        botCount: botPlayers.length,
        totalDeposited, totalDepositsCount: totalDepositsAgg._count.id,
        pendingDeposits, pendingDepositsCount: pendingDepositsAgg._count.id,
        totalTicketSales, totalTicketsCount: totalTicketSalesAgg._count.id,
        totalWithdrawn, totalWithdrawalsCount: totalWithdrawalsAgg._count.id,
        pendingWithdrawals, pendingWithdrawalsCount: pendingWithdrawalsAgg._count.id,
        totalPrizesWon, totalWinnersCount: winnerCount,
        gamesPlayed: gameCount, netCashFlow, houseEdge,
        agentRate: AGENT_RATE, companyRate: COMPANY_RATE,
        fullCommissionRate: companyRate,
        agentEarned, companyEarnedFromBranch,
        totalCommissionExpected, totalCommissionDeducted,
        commissionDebitsCount: commissionDebitsAgg._count.id,
        botDebtAdded, botDebtSettled, outstandingBotDebt,
      },
      // Cash collection history
      allTimeCollected,
      currentPeriodStart,
      allSettlements,
      players: realPlayers,
      topPlayers: topPlayersEnriched,
      recentTransactions, recentDeposits,
      rechargeHistory, commissionDebits,
      monthlyTrend,
    });
  } catch (err: any) {
    logger.error('[Agent Report]', err);
    res.status(500).json({ error: err.message || 'Failed to generate agent report' });
  }
});

// ─── Settle Bot Advantage Debt ────────────────────────────────
staffRouter.post('/agents/:id/settle-debt', staffMiddleware, async (req, res) => {
  try {
    const admin = (req as any).user;
    const agentId = req.params.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid settlement amount' });
    }

    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      include: { agentPreDepositWallet: true }
    });

    if (!agent || !agent.agentPreDepositWallet) {
      return res.status(404).json({ error: 'Agent or wallet not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.agentCommissionLog.create({
        data: {
          agentId,
          walletId: agent.agentPreDepositWallet!.id,
          type: 'BOT_WIN_DEBT_SETTLED',
          amount: amount,
          description: `Admin ${admin.id} settled Bot Advantage debt. Cash collected from agent.`,
          balanceBefore: agent.agentPreDepositWallet!.balance,
          balanceAfter: agent.agentPreDepositWallet!.balance, // debt settlement doesn't change pre-deposit balance
        }
      });
      
      await tx.adminLog.create({
        data: {
          adminId: admin.id,
          targetUserId: agentId,
          action: 'SETTLE_BOT_DEBT',
          details: { amount },
        }
      });
    });

    res.json({ success: true, message: `Successfully settled ${amount} ETB debt.` });
  } catch (err: any) {
    logger.error('[Settle Debt]', err);
    res.status(500).json({ error: 'Failed to settle debt' });
  }
});

// ─── Collect Cash / Settle Period ────────────────────────────────
staffRouter.post('/agents/:id/collect-cash', staffMiddleware, async (req, res) => {
  try {
    const admin = (req as any).user;
    const agentId = req.params.id;
    const { amount, settleDebtAmount } = req.body;

    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      include: { agentPreDepositWallet: true }
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const lastSettlement = await prisma.agentSettlement.findFirst({
      where: { agentId },
      orderBy: { periodEnd: 'desc' }
    });

    const periodStart = lastSettlement ? lastSettlement.periodEnd : agent.createdAt;

    await prisma.$transaction(async (tx) => {
      // 1. Create the Settlement Checkpoint
      await tx.agentSettlement.create({
        data: {
          agentId,
          adminId: admin.id,
          amount: amount || 0,
          periodStart,
          periodEnd: new Date(),
          notes: `Admin collected cash to reset the reporting period.`
        }
      });

      // 2. Clear outstanding bot debt if requested
      if (settleDebtAmount && settleDebtAmount > 0 && agent.agentPreDepositWallet) {
        await tx.agentCommissionLog.create({
          data: {
            agentId,
            walletId: agent.agentPreDepositWallet.id,
            type: 'BOT_WIN_DEBT_SETTLED',
            amount: settleDebtAmount,
            description: `Admin ${admin.id} settled Bot Advantage debt during Period Settlement.`,
            balanceBefore: agent.agentPreDepositWallet.balance,
            balanceAfter: agent.agentPreDepositWallet.balance,
          }
        });
      }

      // 3. Log action
      await tx.adminLog.create({
        data: {
          adminId: admin.id,
          targetUserId: agentId,
          action: 'COLLECT_CASH_SETTLEMENT',
          details: { amount, settleDebtAmount },
        }
      });
    });

    res.json({ success: true, message: `Successfully collected cash and started a new reporting period.` });
  } catch (err: any) {
    logger.error('[Collect Cash]', err);
    res.status(500).json({ error: 'Failed to process cash collection' });
  }
});

// ─── Undo Last Cash Collection ────────────────────────────────
staffRouter.post('/agents/:id/undo-collect', staffMiddleware, async (req, res) => {
  try {
    const admin = (req as any).user;
    const agentId = req.params.id;

    const lastSettlement = await prisma.agentSettlement.findFirst({
      where: { agentId },
      orderBy: { createdAt: 'desc' }
    });

    if (!lastSettlement) {
      return res.status(400).json({ error: 'No collection found to undo.' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete the settlement checkpoint
      await tx.agentSettlement.delete({
        where: { id: lastSettlement.id }
      });

      // 2. Find and delete the corresponding BOT_WIN_DEBT_SETTLED log (created at the exact same time)
      // We look for a log within 5 seconds of the settlement creation
      const timeWindowStart = new Date(lastSettlement.createdAt.getTime() - 5000);
      const timeWindowEnd = new Date(lastSettlement.createdAt.getTime() + 5000);
      
      await tx.agentCommissionLog.deleteMany({
        where: {
          agentId,
          type: 'BOT_WIN_DEBT_SETTLED',
          createdAt: {
            gte: timeWindowStart,
            lte: timeWindowEnd
          }
        }
      });

      // 3. Delete the AdminLog
      await tx.adminLog.deleteMany({
        where: {
          action: 'COLLECT_CASH_SETTLEMENT',
          targetUserId: agentId,
          createdAt: {
            gte: timeWindowStart,
            lte: timeWindowEnd
          }
        }
      });

      // 4. Log the undo action
      await tx.adminLog.create({
        data: {
          adminId: admin.id,
          targetUserId: agentId,
          action: 'UNDO_COLLECTION',
          details: { undoneSettlementId: lastSettlement.id },
        }
      });
    });

    res.json({ success: true, message: 'Successfully undid the last collection.' });
  } catch (err: any) {
    logger.error('[Undo Collect]', err);
    res.status(500).json({ error: 'Failed to undo collection' });
  }
});

staffRouter.post('/users/:id/promote', restrictToAdmin, async (req, res) => {
  const admin = (req as any).user;
  const { promoteToAgent } = await import('../services/user.service');
  try {
    await promoteToAgent(req.params.id, admin.id);
    await logAdminAction(admin.id, 'PROMOTE_TO_AGENT', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Promotion failed' });
  }
});

// ─── Promote user to STAFF role ─────────────────────────────
staffRouter.post('/users/:id/promote-staff', restrictToAdmin, async (req, res) => {
  try {
    const admin = (req as any).user;
    await prisma.user.update({
      where: { id: req.params.id },
      data: { role: 'STAFF', isAdmin: false },
    });
    await logAdminAction(admin.id, 'PROMOTE_TO_STAFF', req.params.id);
    res.json({ success: true, message: 'User promoted to STAFF' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Promotion to STAFF failed' });
  }
});

// ─── Demote STAFF back to PLAYER ────────────────────────────
staffRouter.post('/users/:id/demote-staff', restrictToAdmin, async (req, res) => {
  try {
    const admin = (req as any).user;
    await prisma.user.update({
      where: { id: req.params.id },
      data: { role: 'PLAYER', depositPhones: [] },
    });
    await logAdminAction(admin.id, 'DEMOTE_FROM_STAFF', req.params.id);
    res.json({ success: true, message: 'Staff demoted to PLAYER' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Demotion failed' });
  }
});

// ─── Assign agents to a STAFF user ──────────────────────────
// We store assigned agentIds in the staff user's depositPhones JSON field
// (no DB migration needed — repurposed for staff assignment storage)
staffRouter.post('/staff/:id/assign-agents', restrictToAdmin, async (req, res) => {
  try {
    const { agentIds } = req.body; // array of agent user IDs
    if (!Array.isArray(agentIds)) {
      return res.status(400).json({ error: 'agentIds must be an array' });
    }
    const admin = (req as any).user;
    await prisma.user.update({
      where: { id: req.params.id },
      data: { depositPhones: agentIds },
    });
    await logAdminAction(admin.id, 'ASSIGN_AGENTS_TO_STAFF', req.params.id, { assignedAgents: agentIds });
    res.json({ success: true, assignedAgents: agentIds });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to assign agents' });
  }
});

// ─── Get staff user's assigned agents ───────────────────────
staffRouter.get('/staff/:id/assigned-agents', restrictToAdmin, async (req, res) => {
  try {
    const staffUser = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!staffUser || staffUser.role !== 'STAFF') {
      return res.status(404).json({ error: 'Staff user not found' });
    }
    const agentIds = Array.isArray(staffUser.depositPhones) ? staffUser.depositPhones : [];
    const agents = await prisma.user.findMany({
      where: { id: { in: agentIds as string[] } },
      select: { id: true, firstName: true, telegramUsername: true, referralCode: true }
    });
    res.json({ agentIds, agents });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


staffRouter.post('/agents/:id/recharge', restrictToAdmin, async (req, res) => {
  const admin = (req as any).user;
  const { amount } = req.body;
  const { rechargeAgentPreDepositWallet } = await import('../services/agentPreDeposit.service');
  try {
    const newBalance = await rechargeAgentPreDepositWallet(req.params.id, parseFloat(amount), admin.id);
    await logAdminAction(admin.id, 'RECHARGE_AGENT', req.params.id, { amount: parseFloat(amount), newBalance });
    res.json({ success: true, newBalance });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

staffRouter.patch('/agents/:id/deposit-phones', restrictToAdmin, async (req, res) => {
  try {
    const { depositPhones } = req.body;
    if (!Array.isArray(depositPhones)) {
      return res.status(400).json({ error: 'depositPhones must be an array' });
    }
    const admin = (req as any).user;
    await prisma.user.update({
      where: { id: req.params.id },
      data: { depositPhones },
    });
    await logAdminAction(admin.id, 'UPDATE_DEPOSIT_PHONES', req.params.id, { depositPhones });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update deposit phones' });
  }
});


staffRouter.post('/users/:id/demote', restrictToAdmin, async (req, res) => {
  const admin = (req as any).user;
  const { demoteFromAgent } = await import('../services/user.service');
  try {
    await demoteFromAgent(req.params.id, admin.id);
    await logAdminAction(admin.id, 'DEMOTE_FROM_AGENT', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Demotion failed' });
  }
});

// ─── Edit User (Admin Only) ──────────────────────────────────
staffRouter.patch('/users/:id', restrictToAdmin, async (req, res) => {
  try {
    const { firstName, telegramUsername, phone, status, walletBalance, referredBy } = req.body;
    const updateData: any = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (telegramUsername !== undefined) updateData.telegramUsername = telegramUsername;
    if (phone !== undefined) updateData.phone = phone;
    if (status !== undefined) updateData.status = status;
    if (referredBy !== undefined) {
      updateData.referredBy = referredBy === '' || referredBy === 'none' ? null : referredBy;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // Update wallet balance if provided
    if (walletBalance !== undefined && !isNaN(parseFloat(walletBalance))) {
      await prisma.wallet.updateMany({
        where: { userId: req.params.id },
        data: { balance: parseFloat(walletBalance) },
      });
    }

    const admin = (req as any).user;
    await logAdminAction(admin.id, 'EDIT_USER', req.params.id, updateData);

    res.json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update user' });
  }
});

// ─── Edit Agent (Admin Only) ──────────────────────────────────
staffRouter.patch('/agents/:id', restrictToAdmin, async (req, res) => {
  try {
    const { firstName, telegramUsername, phone, preDepositBalance } = req.body;
    const updateData: any = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (telegramUsername !== undefined) updateData.telegramUsername = telegramUsername;
    if (phone !== undefined) updateData.phone = phone;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // Update pre-deposit balance if provided
    if (preDepositBalance !== undefined && !isNaN(parseFloat(preDepositBalance))) {
      const newBalance = parseFloat(preDepositBalance);
      await prisma.agentPreDepositWallet.upsert({
        where: { agentId: req.params.id },
        create: {
          agentId: req.params.id,
          balance: newBalance,
          totalRecharged: newBalance,
        },
        update: {
          balance: newBalance,
          totalRecharged: newBalance,
          updatedAt: new Date(),
        },
      });
    }

    res.json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update agent' });
  }
});

staffRouter.get('/analytics', staffMiddleware, async (req, res) => {
  const dateStr = req.query.date as string;       // legacy: single date 'YYYY-MM-DD'
  const startDateStr = req.query.startDate as string; // range start 'YYYY-MM-DD'
  const endDateStr   = req.query.endDate   as string; // range end   'YYYY-MM-DD'
  const agentIdQuery = req.query.agentId as string;   // Optional agent filter
  const admin = (req as any).user;
  
  let agentIds: string[] | undefined = undefined;

  // If a specific agentId is requested
  if (agentIdQuery) {
    agentIds = [agentIdQuery];
  } 
  // If no specific agent requested, but user is STAFF, enforce filtering by their assigned agents
  else if (admin.role === 'STAFF') {
    const assigned = Array.isArray(admin.depositPhones) ? admin.depositPhones : [];
    agentIds = assigned;
    // If a staff has 0 assigned agents, we should still filter down to an empty array so they see 0.
    if (agentIds.length === 0) {
      agentIds = ['00000000-0000-0000-0000-000000000000'];
    }
  }

  // Resolve the date window (range takes priority over legacy single-date)
  let todayStart: Date;
  let todayEnd: Date;

  if (startDateStr && endDateStr) {
    todayStart = new Date(startDateStr);
    todayStart.setHours(0, 0, 0, 0);
    todayEnd = new Date(endDateStr);
    todayEnd.setHours(23, 59, 59, 999);
  } else if (dateStr) {
    // legacy single-date mode
    todayStart = new Date(dateStr);
    todayStart.setHours(0, 0, 0, 0);
    todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);
  } else {
    // Default: today only
    todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);
  }

  const userFilter = agentIds ? { referredBy: { in: agentIds } } : {};
  const txFilter = agentIds ? { user: { referredBy: { in: agentIds } } } : {};
  const ticketFilter = agentIds ? { user: { referredBy: { in: agentIds } } } : {};
  const commFilter = agentIds ? { agentId: { in: agentIds } } : {};

  const [
    totalUsers,
    totalGamesAllTime,
    activeGames,
    totalDepositsAllTime,
    totalWithdrawalsAllTime,
    pendingDeposits,
    pendingWithdrawals,
    globalSalesAllTimeAgg,
    totalCompanyRevenueAllTimeAgg,
    // Today's stats
    globalSalesTodayAgg,
    totalCompanyRevenueTodayAgg,
    activePlayersTodayCount,
    activeGamesTodayCount,
    // Tickets purchased today for room breakdown
    ticketsToday,
    agentPreDepositObj,
    bunaWallet
  ] = await Promise.all([
    prisma.user.count({ where: userFilter }),
    prisma.game.count({ where: { status: 'FINISHED' } }),
    prisma.game.count({ where: { status: { in: ['RUNNING', 'COUNTDOWN', 'WAITING'] } } }),
    prisma.deposit.aggregate({ where: { status: { in: ['approved', 'APPROVED', 'completed', 'COMPLETED'] }, ...txFilter }, _sum: { amount: true } }),
    prisma.withdrawal.aggregate({ where: { status: { in: ['approved', 'APPROVED', 'completed', 'COMPLETED'] }, ...txFilter }, _sum: { amount: true } }),
    prisma.deposit.count({ where: { status: { in: ['pending', 'PENDING'] }, ...txFilter } }),
    prisma.withdrawal.count({ where: { status: { in: ['pending', 'PENDING'] }, ...txFilter } }),
    prisma.transaction.aggregate({ 
      where: { type: 'TICKET_PURCHASE', status: { in: ['completed', 'COMPLETED'] }, user: { isBot: false }, ...txFilter }, 
      _sum: { amount: true, balanceBefore: true, balanceAfter: true } 
    }),
    prisma.agentCommissionLog.aggregate({ 
      where: { type: 'COMMISSION_DEBIT', ...commFilter }, 
      _sum: { amount: true } 
    }),
    // Today's Sales (Real Gross Volume)
    prisma.transaction.aggregate({
      where: { type: 'TICKET_PURCHASE', status: { in: ['completed', 'COMPLETED'] }, user: { isBot: false }, createdAt: { gte: todayStart, lte: todayEnd }, ...txFilter },
      _sum: { amount: true, balanceBefore: true, balanceAfter: true }
    }),
    // Today's Company Revenue
    prisma.agentCommissionLog.aggregate({
      where: { type: 'COMMISSION_DEBIT', createdAt: { gte: todayStart, lte: todayEnd }, ...commFilter },
      _sum: { amount: true }
    }),
    // Distinct players active today
    prisma.transaction.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: todayStart, lte: todayEnd }, ...txFilter }
    }),
    // Games played today
    prisma.game.count({
      where: { createdAt: { gte: todayStart, lte: todayEnd } }
    }),
    // Tickets purchased today for room breakdown
    prisma.ticket.findMany({
      where: { purchasedAt: { gte: todayStart, lte: todayEnd }, ...ticketFilter },
      include: {
        game: {
          include: {
            room: true
          }
        }
      }
    }),
    // Pre-deposit wallet totals — specific agents OR sum of ALL agents
    agentIds 
      ? prisma.agentPreDepositWallet.aggregate({
          where: { agentId: { in: agentIds } },
          _sum: { balance: true, totalDebited: true, totalRecharged: true }
        })
      : prisma.agentPreDepositWallet.aggregate({
          _sum: { balance: true, totalDebited: true, totalRecharged: true }
        }),
    // Buna (System) Wallet
    prisma.systemWallet.findUnique({
      where: { id: 1 }
    })
  ]);

  // Group tickets by room type
  const roomStats: Record<string, { totalStake: number; ticketPrice: number; ticketCount: number }> = {
    CASUAL: { totalStake: 0, ticketPrice: 10, ticketCount: 0 },
    STANDARD: { totalStake: 0, ticketPrice: 20, ticketCount: 0 },
    PRO: { totalStake: 0, ticketPrice: 50, ticketCount: 0 },
    JACKPOT: { totalStake: 0, ticketPrice: 100, ticketCount: 0 },
    VIP: { totalStake: 0, ticketPrice: 200, ticketCount: 0 }
  };

  ticketsToday.forEach(ticket => {
    const type = ticket.game?.room?.type;
    const price = Number(ticket.game?.room?.ticketPrice || 0);
    if (type && roomStats[type]) {
      roomStats[type].ticketCount += 1;
      roomStats[type].totalStake += price;
    }
  });

  // NOTE: breakdown is finalized after companyRate is loaded below

  // Pre-deposit totals: agentIds uses aggregate sums over subset; global uses aggregate sums over all
  let totalPreDepositBalance: number;
  let totalPreDepositAdded: number;

  const sums = (agentPreDepositObj as any)?._sum;
  totalPreDepositBalance = Number(sums?.balance || 0);
  totalPreDepositAdded   = Number(sums?.totalRecharged || 0);

  const bunaWalletBalance = Number(bunaWallet?.balance || 0);

  // Real vs Bot Sales Split (all-time)
  // Real player sales = ticket purchases by non-bot users
  const realSalesAgg = await prisma.transaction.aggregate({
    where: {
      type: 'TICKET_PURCHASE',
      status: { in: ['completed', 'COMPLETED'] },
      user: { isBot: false },
      ...(agentIds ? { user: { referredBy: { in: agentIds }, isBot: false } } : {})
    },
    _sum: { amount: true, balanceBefore: true, balanceAfter: true }
  });
  // Bot sales = ticket purchases by bot users (synthetic/fake stake)
  const botSalesAgg = await prisma.transaction.aggregate({
    where: {
      type: 'TICKET_PURCHASE',
      status: { in: ['completed', 'COMPLETED'] },
      user: { isBot: true },
      ...(agentIds ? { user: { referredBy: { in: agentIds }, isBot: true } } : {})
    },
    _sum: { amount: true }
  });

  // House Bot Advantage: TRUE real money kept by house from bot wins.
  // Formula: (Real Sales * 70%) - Total Prizes Won by Real Players
  const realPlayerWinningsAgg = await prisma.transaction.aggregate({
    where: {
      type: 'PRIZE_WIN',
      status: { in: ['completed', 'COMPLETED'] },
      user: { isBot: false },
      ...(agentIds ? { user: { referredBy: { in: agentIds }, isBot: false } } : {})
    },
    _sum: { amount: true }
  });

  const botWinnerRecords = await prisma.winner.aggregate({
    where: {
      user: { isBot: true },
      ...(agentIds ? { user: { referredBy: { in: agentIds }, isBot: true } } : {})
    },
    _count: { id: true },
  });

  const realGrossSalesCash = Number(realSalesAgg._sum.balanceBefore || 0) - Number(realSalesAgg._sum.balanceAfter || 0);
  const realGrossSales = realGrossSalesCash; // Use true cash calculation
  const botGrossSales  = Number(botSalesAgg._sum.amount || 0);
  
  const realPlayerWinnings = Number(realPlayerWinningsAgg._sum.amount || 0);
  // Real prize pool theoretically available from real player stakes is 70%
  // Whatever was NOT won by real players was kept by the house when bots won.
  const botWinPayoutAmount = Math.max(0, (realGrossSales * 0.70) - realPlayerWinnings);
  const botWinCount = Number(botWinnerRecords._count?.id || 0);

  // Dynamic Revenue Split Settings
  const { getAgentProfitRate, getCompanyCommissionRate } = await import('../services/settings.service');
  const agentRate = await getAgentProfitRate(); // e.g. 0.06 (6%)
  const companyRate = await getCompanyCommissionRate(); // e.g. 0.30 (30%)

  // NCF Split Rates
  const AGENT_RATE = companyRate > 0 ? agentRate / companyRate : 0.20;
  const COMPANY_RATE = Math.max(0, 1 - AGENT_RATE);

  // Breakdown using dynamic companyRate (fixes hardcoded 0.25 bug)
  const breakdown = Object.keys(roomStats).map(key => ({
    gameType: key,
    entryFee: roomStats[key].ticketPrice,
    totalStake: roomStats[key].totalStake,
    serviceFee: roomStats[key].totalStake * companyRate
  }));

  // For all-time stats based on ticket sales, Expected NCF = Sales * House Edge (companyRate)
  const expectedRealNCF = realGrossSales * companyRate;
  const expectedBotNCF  = botGrossSales * companyRate;

  const realCompanyRevenue = expectedRealNCF * COMPANY_RATE;
  // realAgentRevenue: all-time agent share — NOTE: for all-time view, still uses expected NCF
  // as all-time deposits/withdrawals can't be easily scoped. This is for reference in the accounting section.
  const realAgentRevenue   = expectedRealNCF * AGENT_RATE;
  const botCompanyRevenue  = expectedBotNCF  * COMPANY_RATE;  // synthetic — NOT real profit

  const todayGlobalSales = Number(globalSalesTodayAgg._sum.balanceBefore || 0) - Number(globalSalesTodayAgg._sum.balanceAfter || 0);
  // Today's real sales (non-bot tickets purchased today)
  const todayRealSalesAgg = await prisma.transaction.aggregate({
    where: {
      type: 'TICKET_PURCHASE',
      status: { in: ['completed', 'COMPLETED'] },
      user: { isBot: false },
      createdAt: { gte: todayStart, lte: todayEnd },
      ...(agentIds ? { user: { referredBy: { in: agentIds }, isBot: false } } : {})
    },
    _sum: { amount: true, balanceBefore: true, balanceAfter: true }
  });
  // Period deposits and withdrawals (for Net Cash Flow based commission)
  const [periodDepositsAgg, periodWithdrawalsAgg] = await Promise.all([
    prisma.deposit.aggregate({
      where: {
        status: { in: ['approved', 'APPROVED', 'completed', 'COMPLETED'] },
        createdAt: { gte: todayStart, lte: todayEnd },
        ...(agentIds ? { user: { referredBy: { in: agentIds } } } : { user: { isBot: false } })
      },
      _sum: { amount: true }
    }),
    prisma.withdrawal.aggregate({
      where: {
        status: { in: ['approved', 'APPROVED', 'completed', 'COMPLETED'] },
        createdAt: { gte: todayStart, lte: todayEnd },
        ...(agentIds ? { user: { referredBy: { in: agentIds } } } : { user: { isBot: false } })
      },
      _sum: { amount: true }
    }),
  ]);
  const todayRealSales = Number(todayRealSalesAgg._sum.balanceBefore || 0) - Number(todayRealSalesAgg._sum.balanceAfter || 0);
  const periodDeposited   = Number(periodDepositsAgg._sum.amount || 0);
  const periodWithdrawn   = Number(periodWithdrawalsAgg._sum.amount || 0);
  const periodNetCashFlow = Math.max(0, periodDeposited - periodWithdrawn);
  // Period commission: Agent earns AGENT_RATE of Net Cash Flow; company keeps the rest
  const todayAgentRevenue   = periodNetCashFlow * AGENT_RATE;
  const todayCompanyRevenue = periodNetCashFlow - todayAgentRevenue;

  // Build a human-readable date range label for the frontend
  const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const dateRangeLabel = todayStart.toDateString() === todayEnd.toDateString()
    ? fmtDate(todayStart)
    : `${fmtDate(todayStart)} – ${fmtDate(todayEnd)}`;

  res.json({
    totalUsers,
    totalGames: totalGamesAllTime,
    activeGames,
    totalDeposited: totalDepositsAllTime._sum.amount || 0,
    totalWithdrawn: totalWithdrawalsAllTime._sum.amount || 0,
    pendingDeposits,
    pendingWithdrawals,
    globalSales: (Number(globalSalesAllTimeAgg._sum.balanceBefore || 0) - Number(globalSalesAllTimeAgg._sum.balanceAfter || 0)),
    totalCompanyRevenue: totalCompanyRevenueAllTimeAgg._sum.amount || 0,
    preDepositBalance: totalPreDepositBalance,
    preDepositAdded: totalPreDepositAdded,
    bunaWalletBalance,
    // Dynamic rates for frontend display
    companyRevenueRate: COMPANY_RATE * 100,
    agentRevenueRate: AGENT_RATE * 100,
    companyCommissionRate: companyRate * 100,
    // Date range info
    dateRangeLabel,
    rangeStart: todayStart.toISOString().split('T')[0],
    rangeEnd: todayEnd.toISOString().split('T')[0],
    // ── Real vs Bot breakdown (all-time, key for admin accounting) ──
    realGrossSales,           // real player ticket sales (real ETB)
    botGrossSales,            // house bot ticket sales (synthetic ETB)
    realCompanyRevenue,       // actual company profit
    realAgentRevenue,         // actual agent profit
    botCompanyRevenue,        // synthetic/fake (NOT real profit)
    realPlayerWinnings,       // amount won by real players
    botWinPayoutAmount,       // House Advantage: total bot wins kept in system
    botWinCount,              // House Advantage: number of bot wins
    // Period's values (scoped to selected date range, from real sales only)
    today: {
      globalSales: todayGlobalSales,
      realSales: todayRealSales,
      totalCompanyRevenue: todayCompanyRevenue,
      totalAgentRevenue: todayAgentRevenue,
      activePlayers: activePlayersTodayCount.length,
      activeGames: activeGamesTodayCount,
      breakdown
    }
  });
});

// ── House Bot Revenue Analytics (dedicated endpoint) ─────────────────────────
staffRouter.get('/bot-analytics', restrictToAdmin, async (req, res) => {
  try {
    const now = new Date();

    // Build last-7-days date range array
    const days: { start: Date; end: Date; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end   = new Date(d); end.setHours(23, 59, 59, 999);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      days.push({ start, end, label });
    }

    // All-time aggregates in parallel
    const [
      totalBotTicketsAgg,
      totalBotSalesAgg,
      totalRealSalesAgg,
      totalAllSalesAgg,
      botPlayerCount,
      realPlayerCount,
      totalGamesFinished,
      houseBotWinsAgg,
      botWinnerRecords,
      realPlayerWinningsAgg,
    ] = await Promise.all([
      // Count of tickets purchased by bots
      prisma.ticket.count({ where: { user: { isBot: true } } }),
      // Sum of ETB bot tickets represent
      prisma.transaction.aggregate({
        where: { type: 'TICKET_PURCHASE', status: 'COMPLETED', user: { isBot: true } },
        _sum: { amount: true }
      }),
      // Sum of ETB real player tickets represent (real cash only — excludes bonus ETB)
      prisma.transaction.aggregate({
        where: { type: 'TICKET_PURCHASE', status: 'COMPLETED', user: { isBot: false } },
        _sum: { amount: true, balanceBefore: true, balanceAfter: true }
      }),
      // Total all sales
      prisma.transaction.aggregate({
        where: { type: 'TICKET_PURCHASE', status: 'COMPLETED' },
        _sum: { amount: true }
      }),
      // Bot player count
      prisma.user.count({ where: { isBot: true } }),
      // Real player count
      prisma.user.count({ where: { isBot: false } }),
      // Total finished games
      prisma.game.count({ where: { status: 'FINISHED' } }),
      // Count of house bot wins from gameCycle tracker
      prisma.gameCycle.aggregate({ _sum: { houseWins: true } }),
      // Bot winner records: just count the wins.
      prisma.winner.aggregate({
        where: { user: { isBot: true } },
        _count: { id: true },
      }),
      // Real player winnings (to calculate TRUE house advantage)
      prisma.transaction.aggregate({
        where: { type: 'PRIZE_WIN', status: 'COMPLETED', user: { isBot: false } },
        _sum: { amount: true }
      }),
    ]);

    const totalBotSales = Number(totalBotSalesAgg._sum.amount || 0);
    // Real sales = real cash only (balanceBefore - balanceAfter), excluding bonus ETB
    const totalRealSales = Number(totalRealSalesAgg._sum.balanceBefore || 0) - Number(totalRealSalesAgg._sum.balanceAfter || 0);
    const totalAllSales = Number(totalAllSalesAgg._sum.amount || 0);
    // House bot win COUNT from gameCycle tracker
    const botWinPayouts = Number(houseBotWinsAgg._sum.houseWins || 0);
    
    // House bot win PRIZE AMOUNT (TRUE Real Money): 
    // The prize pool allocated to players is 70% of real ticket sales.
    // The money that actually stayed in the system is that 70% minus the money ACTUALLY WON by real players.
    const realPlayerWinnings = Number(realPlayerWinningsAgg._sum.amount || 0);
    const botWinPayoutAmount = Math.max(0, (totalRealSales * 0.70) - realPlayerWinnings);
    const botWinCount = Number(botWinnerRecords._count?.id || 0);

    // Dynamic Revenue Split Settings
    const { getAgentProfitRate, getCompanyCommissionRate } = await import('../services/settings.service');
    const agentRate = await getAgentProfitRate(); // e.g. 0.06 (6%)
    const companyRate = await getCompanyCommissionRate(); // e.g. 0.30 (30%)

    const AGENT_RATE = agentRate;
    const COMPANY_RATE = Math.max(0, companyRate - agentRate);

    const realCompanyRevenue = totalRealSales * COMPANY_RATE;
    const realAgentRevenue   = totalRealSales * AGENT_RATE;
    const botCompanyRevenue  = totalBotSales  * COMPANY_RATE; // synthetic — NOT real
    const botParticipationRate = totalAllSales > 0 ? (totalBotSales / totalAllSales) * 100 : 0;

    // 7-day daily trend (parallel queries per day)
    const trend = await Promise.all(
      days.map(async ({ start, end, label }) => {
        const [dayBotSalesAgg, dayRealSalesAgg] = await Promise.all([
          prisma.transaction.aggregate({
            where: { type: 'TICKET_PURCHASE', status: 'COMPLETED', user: { isBot: true }, createdAt: { gte: start, lte: end } },
            _sum: { amount: true }
          }),
          prisma.transaction.aggregate({
            where: { type: 'TICKET_PURCHASE', status: 'COMPLETED', user: { isBot: false }, createdAt: { gte: start, lte: end } },
            _sum: { amount: true, balanceBefore: true, balanceAfter: true }
          }),
        ]);
        const dayBotSales  = Number(dayBotSalesAgg._sum.amount || 0);
        // Real cash only for each day — excludes bonus ETB used
        const dayRealSales = Number(dayRealSalesAgg._sum.balanceBefore || 0) - Number(dayRealSalesAgg._sum.balanceAfter || 0);
        return {
          label,
          botSales: dayBotSales,
          realSales: dayRealSales,
          companyRevenue: dayRealSales * COMPANY_RATE,
          agentRevenue:   dayRealSales * AGENT_RATE,
        };
      })
    );

    // Per-room breakdown: real vs bot ticket sales
    const roomTypes = ['CASUAL', 'STANDARD', 'PRO', 'JACKPOT', 'VIP'];
    const roomPrices: Record<string, number> = { CASUAL: 10, STANDARD: 20, PRO: 50, JACKPOT: 100, VIP: 200 };

    const roomBreakdown = await Promise.all(
      roomTypes.map(async (roomType) => {
        const [realTickets, botTickets] = await Promise.all([
          prisma.ticket.count({ where: { user: { isBot: false }, game: { room: { type: roomType as any } } } }),
          prisma.ticket.count({ where: { user: { isBot: true  }, game: { room: { type: roomType as any } } } }),
        ]);
        const price = roomPrices[roomType] || 0;
        return {
          roomType,
          ticketPrice: price,
          realTickets,
          botTickets,
          realSales: realTickets * price,
          botSales:  botTickets  * price,
          realRevenue: realTickets * price * COMPANY_RATE,
        };
      })
    );

    res.json({
      success: true,
      data: {
        // All-time totals
        totalBotTickets: totalBotTicketsAgg,
        totalBotSales,           // synthetic ETB — NOT real cash
        totalRealSales,          // real ETB from real players
        totalAllSales,
        botParticipationRate,    // % of total sales that are bot sales
        botPlayerCount,
        realPlayerCount,
        totalGamesFinished,
        botWinPayouts,           // count of house bot wins (from gameCycle tracker)
        botWinCount,             // count of Winner records where winner.user.isBot=true
        // Prize money the house BOT "won" — this amount STAYED in the system reserve.
        botWinPayoutAmount,
        realCompanyRevenue,      // ✅ REAL
        realAgentRevenue,        // ✅ REAL
        botCompanyRevenue,       // ⚠ SYNTHETIC (NOT real profit)
        // Dynamic rates for frontend
        companyRevenueRate: COMPANY_RATE * 100,
        agentRevenueRate: AGENT_RATE * 100,
        companyCommissionRate: companyRate * 100,
        // 7-day trend
        trend,
        // Per-room breakdown
        roomBreakdown,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch bot analytics' });
  }
});

staffRouter.get('/audit', restrictToAdmin, async (req, res) => {
  try {
    const { getCompanyCommissionRate, getAgentProfitRate } = await import('../services/settings.service');
    
    const [
      bunaWallet,
      houseBotWinsAgg,
      totalSalesAgg,
      commissionsAgg,
      agentsCount,
      totalDepositsAgg,
      totalWithdrawalsAgg,
      rate,
      agentRate,
      realSalesAgg,
      botSalesAgg,
      agentPreDepositAgg,
      realPrizesAgg,
    ] = await Promise.all([
      prisma.systemWallet.findUnique({ where: { id: 1 } }),
      prisma.gameCycle.aggregate({ _sum: { houseWins: true } }),
      // Fix: transactions saved as 'completed' (lowercase)
      prisma.transaction.aggregate({ where: { type: 'TICKET_PURCHASE', status: { in: ['completed', 'COMPLETED'] } }, _sum: { amount: true } }),
      prisma.agentCommissionLog.aggregate({ where: { type: 'COMMISSION_DEBIT' }, _sum: { amount: true } }),
      prisma.user.count({ where: { role: 'AGENT' } }),
      // Fix: deposits saved as 'approved' (lowercase)
      prisma.deposit.aggregate({ where: { status: { in: ['approved', 'APPROVED', 'completed', 'COMPLETED'] } }, _sum: { amount: true } }),
      // Fix: withdrawals saved as 'approved' (lowercase) when paid out
      prisma.withdrawal.aggregate({ where: { status: { in: ['approved', 'APPROVED', 'completed', 'COMPLETED'] } }, _sum: { amount: true } }),
      getCompanyCommissionRate(),
      getAgentProfitRate(),
      // Fix: status lowercase — also fetch balanceBefore/After to calculate real cash only
      prisma.transaction.aggregate({ where: { type: 'TICKET_PURCHASE', status: { in: ['completed', 'COMPLETED'] }, user: { isBot: false } }, _sum: { amount: true, balanceBefore: true, balanceAfter: true } }),
      prisma.transaction.aggregate({ where: { type: 'TICKET_PURCHASE', status: { in: ['completed', 'COMPLETED'] }, user: { isBot: true } }, _sum: { amount: true } }),
      prisma.agentPreDepositWallet.aggregate({ _sum: { totalRecharged: true, totalDebited: true, balance: true } }),
      // Real player prize wins paid out
      prisma.transaction.aggregate({ where: { type: 'PRIZE_WIN', status: { in: ['completed', 'COMPLETED'] }, user: { isBot: false } }, _sum: { amount: true } }),
    ]);

    const totalSales = Number(totalSalesAgg._sum.amount || 0);
    // Real player sales = real cash only (excludes bonus ETB used for tickets)
    const realPlayerSales = Number(realSalesAgg._sum.balanceBefore || 0) - Number(realSalesAgg._sum.balanceAfter || 0);
    const botSales = Number(botSalesAgg._sum.amount || 0);
    const totalCommissionsDeducted = Number(commissionsAgg._sum.amount || 0);
    const expectedCommissions = realPlayerSales * rate;
    const totalDeposits = Number(totalDepositsAgg._sum.amount || 0);
    const totalWithdrawals = Number(totalWithdrawalsAgg._sum.amount || 0);

    // ─── Real Company Profit Breakdown ─────────────────────────────────────
    // Commission split: 30% total from real player ticket sales
    //   Company share = 20% (rate - agentRate)
    //   Agent share   = 10% (agentRate)
    const companyCommissionRate = rate - agentRate; // e.g. 0.30 - 0.10 = 0.20
    const companyCommissionEarned = realPlayerSales * companyCommissionRate;
    const agentCommissionEarned = realPlayerSales * agentRate;

    // House edge: ticket revenue from real players minus prizes paid to real players
    const realPlayerPrizes = Number(realPrizesAgg._sum.amount || 0);
    const houseEdgeFromRealPlayers = realPlayerSales - realPlayerPrizes;

    // Net cash position: money in minus money out
    const netCashFlow = totalDeposits - totalWithdrawals;

    res.json({
      success: true,
      data: {
        bunaWalletBalance: Number(bunaWallet?.balance || 0),
        totalHouseWins: Number(houseBotWinsAgg._sum.houseWins || 0),
        totalSales,
        realPlayerSales,
        botSales,
        totalCommissionsDeducted,
        expectedCommissions,
        commissionRate: rate,
        agentRate,
        companyCommissionRate,
        // Real profit metrics
        companyCommissionEarned,
        agentCommissionEarned,
        realPlayerPrizes,
        houseEdgeFromRealPlayers,
        netCashFlow,
        // Deposits & withdrawals
        totalDeposits,
        totalWithdrawals,
        agentsCount,
        agentPreDepositTotalRecharged: Number(agentPreDepositAgg._sum?.totalRecharged || 0),
        agentPreDepositTotalDebited: Number(agentPreDepositAgg._sum?.totalDebited || 0),
        agentPreDepositCurrentBalance: Number(agentPreDepositAgg._sum?.balance || 0),
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
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
    const [
      companyCommissionRate,
      agentProfitRate,
      bonusActive,
      bonusPercent,
      bonusMinDeposit,
      bonusExpiry,
      houseBotEnabled
    ] = await Promise.all([
      getSystemSetting('COMPANY_COMMISSION_RATE'),
      getSystemSetting('AGENT_PROFIT_RATE'),
      getSystemSetting('BONUS_ACTIVE'),
      getSystemSetting('BONUS_PERCENT'),
      getSystemSetting('BONUS_MIN_DEPOSIT'),
      getSystemSetting('BONUS_EXPIRY'),
      getSystemSetting('HOUSE_BOT_ENABLED'),
    ]);
    res.json({
      COMPANY_COMMISSION_RATE: companyCommissionRate || '12.5',
      AGENT_PROFIT_RATE: agentProfitRate || '12.5',
      BONUS_ACTIVE: bonusActive === 'true',
      BONUS_PERCENT: bonusPercent || '100',
      BONUS_MIN_DEPOSIT: bonusMinDeposit || '50',
      BONUS_EXPIRY: bonusExpiry || '',
      HOUSE_BOT_ENABLED: houseBotEnabled !== 'false', // Defaults to true
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

staffRouter.put('/settings', restrictToAdmin, async (req, res) => {
  const { setSystemSetting } = await import('../services/settings.service');
  const allowed = [
    'COMPANY_COMMISSION_RATE',
    'AGENT_PROFIT_RATE',
    'BONUS_ACTIVE',
    'BONUS_PERCENT',
    'BONUS_MIN_DEPOSIT',
    'BONUS_EXPIRY',
    'HOUSE_BOT_ENABLED',
  ];
  try {
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        await setSystemSetting(key, String(req.body[key]));
      }
    }
    const admin = (req as any).user;
    await logAdminAction(admin.id, 'UPDATE_SETTINGS', null, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ─── Promotions CRUD ──────────────────────────────────────────
// GET all promotions
staffRouter.get('/promotions', restrictToAdmin, async (req, res) => {
  try {
    const promotions = await prisma.promotion.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(promotions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
});

// CREATE a promotion
staffRouter.post('/promotions', restrictToAdmin, async (req, res) => {
  // Only run multer if the request is multipart/form-data (i.e. includes an image).
  // Plain JSON requests should skip multer entirely.
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    try {
      await runUpload(req, res, upload.single('image'));
    } catch (uploadErr: any) {
      logger.error('Promotion upload error:', uploadErr);
      return res.status(400).json({ error: `Image upload failed: ${uploadErr.message || String(uploadErr)}` });
    }
  }

  const { title, message, type, scheduledAt, expiresAt, isActive } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }
  
  const parseDate = (val: any) => {
    if (!val || val === 'null' || val === 'undefined' || val === '') return null;
    return new Date(val);
  };
  // Default isActive to true unless explicitly set to false
  const activeVal = isActive === 'false' || isActive === false ? false : true;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const promotion = await prisma.promotion.create({
      data: {
        title,
        message,
        type: type || 'announcement',
        imageUrl,
        isActive: activeVal,
        scheduledAt: parseDate(scheduledAt),
        expiresAt: parseDate(expiresAt),
        sentAt: activeVal ? new Date() : null,
      },
    });

    // Automatically broadcast active announcements immediately upon creation
    if (activeVal) {
      const { broadcastMessage } = await import('../bot/notifier');
      const formattedMessage = `📢 <b>${promotion.title}</b>\n\n${promotion.message}`;
      const readMoreUrl = `${config.bot.miniAppUrl}/announcements/${promotion.id}`;

      broadcastMessage(formattedMessage, promotion.imageUrl, undefined, readMoreUrl).catch((broadcastErr) => {
        logger.error(`[Broadcast] Background broadcast failed for newly created promotion ${promotion.id}:`, broadcastErr);
      });
    }

    const admin = (req as any).user;
    await logAdminAction(admin.id, 'CREATE_PROMOTION', promotion.id, promotion);

    res.json(promotion);
  } catch (err: any) {
    logger.error('Promotion creation error:', err);
    res.status(500).json({ error: `Failed to create promotion: ${err.message || String(err)}` });
  }
});

// UPDATE a promotion
staffRouter.patch('/promotions/:id', restrictToAdmin, async (req, res) => {
  // Only run multer if the request is multipart/form-data (i.e. includes a file upload).
  // Plain JSON PATCH requests (e.g. toggle isActive) should skip multer entirely.
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    try {
      await runUpload(req, res, upload.single('image'));
    } catch (uploadErr: any) {
      logger.error('Promotion update upload error:', uploadErr);
      return res.status(400).json({ error: `Image upload failed: ${uploadErr.message || String(uploadErr)}` });
    }
  }

  const { id } = req.params;
  const { title, message, type, scheduledAt, expiresAt, isActive, removeImage } = req.body;
  
  const parseDate = (val: any) => {
    if (!val || val === 'null' || val === 'undefined' || val === '') return null;
    return new Date(val);
  };
  
  try {
    let imageUrlUpdate: any = undefined;
    if (req.file) {
      imageUrlUpdate = `/uploads/${req.file.filename}`;
    } else if (removeImage === 'true' || removeImage === true) {
      imageUrlUpdate = null;
    }

    const promotion = await prisma.promotion.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(message !== undefined && { message }),
        ...(type !== undefined && { type }),
        ...(isActive !== undefined && { isActive: isActive === 'true' || isActive === true }),
        ...(scheduledAt !== undefined && { scheduledAt: parseDate(scheduledAt) }),
        ...(expiresAt !== undefined && { expiresAt: parseDate(expiresAt) }),
        ...(imageUrlUpdate !== undefined && { imageUrl: imageUrlUpdate }),
        updatedAt: new Date(),
      },
    });

    const admin = (req as any).user;
    await logAdminAction(admin.id, 'EDIT_PROMOTION', id, promotion);

    res.json(promotion);
  } catch (err: any) {
    logger.error('Promotion update error:', err);
    res.status(500).json({ error: `Failed to update promotion: ${err.message || String(err)}` });
  }
});

// DELETE a promotion
staffRouter.delete('/promotions/:id', restrictToAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.promotion.delete({ where: { id } });
    const admin = (req as any).user;
    await logAdminAction(admin.id, 'DELETE_PROMOTION', id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete promotion' });
  }
});

// BROADCAST a promotion (mark as sent - triggers Telegram bot notification)
staffRouter.post('/promotions/:id/broadcast', restrictToAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const promotion = await prisma.promotion.findUnique({ where: { id } });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });

    // Mark as sent
    await prisma.promotion.update({
      where: { id },
      data: { sentAt: new Date(), updatedAt: new Date() },
    });

    // Actually trigger Telegram bot notification broadcast in background
    const { broadcastMessage } = await import('../bot/notifier');
    const formattedMessage = `📢 <b>${promotion.title}</b>\n\n${promotion.message}`;
    const readMoreUrl = `${config.bot.miniAppUrl}/announcements/${id}`;

    broadcastMessage(formattedMessage, promotion.imageUrl, undefined, readMoreUrl).catch((err) => {
      console.error(`[Broadcast] Background broadcast failed for promotion ${id}:`, err);
    });

    // Get total recipient count for response
    const totalRecipients = await prisma.user.count();

    const admin = (req as any).user;
    await logAdminAction(admin.id, 'BROADCAST_PROMOTION', id, { totalRecipients });

    res.json({ success: true, totalRecipients, message: 'Broadcast queued successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to broadcast promotion' });
  }
});

// ─── Agent Routes ─────────────────────────────────────────────
import agentRouter from './agent';
router.use('/agent', agentRouter);


// ─── Auth Routes ──────────────────────────────────────────────


// ─── Create Staff (Admin/Agent) without Telegram ─────────────
staffRouter.post('/staff/create', restrictToAdmin, async (req, res) => {
  const { telegramId, username, firstName, role, password } = req.body;
  if (!telegramId || !username || !role || !password) {
    return res.status(400).json({ error: 'telegramId, username, role and password are required.' });
  }
  if (!['ADMIN', 'AGENT', 'STAFF'].includes(role)) {
    return res.status(400).json({ error: 'Role must be ADMIN, AGENT, or STAFF.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  try {
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.default.hash(password, 10);
    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(telegramId) },
      create: {
        telegramId: BigInt(telegramId),
        telegramUsername: username.replace('@', ''),
        firstName: firstName || username,
        role,
        isAdmin: role === 'ADMIN',
        passwordHash,
        status: 'ACTIVE',
        wallet: { create: { balance: 0 } },
      },
      update: {
        telegramUsername: username.replace('@', ''),
        firstName: firstName || undefined,
        role,
        isAdmin: role === 'ADMIN',
        passwordHash,
        status: 'ACTIVE',
      },
    });
    // Create pre-deposit wallet for agents
    if (role === 'AGENT') {
      const { getOrCreateAgentPreDepositWallet } = await import('../services/agentPreDeposit.service');
      await getOrCreateAgentPreDepositWallet(user.id);
    }
    res.json({ success: true, user: { id: user.id, telegramUsername: user.telegramUsername, role: user.role } });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A user with this Telegram ID or username already exists.' });
    res.status(500).json({ error: err.message || 'Failed to create staff member.' });
  }
});


// ─── Admin Logs ───────────────────────────────────────────────
staffRouter.get('/logs', restrictToAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const action = req.query.action as string;
    const search = req.query.search as string;

    const where: any = {};
    if (action) where.action = action;
    if (search) {
      where.OR = [
        { admin: { firstName: { contains: search, mode: 'insensitive' } } },
        { targetUser: { firstName: { contains: search, mode: 'insensitive' } } },
        { action: { contains: search, mode: 'insensitive' } }
      ];
    }

    const logs = await prisma.adminLog.findMany({
      where,
      include: {
        admin: { select: { id: true, firstName: true, telegramUsername: true } },
        targetUser: { select: { id: true, firstName: true, telegramUsername: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalLogs = await prisma.adminLog.count({ where });

    res.json({
      logs,
      pagination: {
        page,
        limit,
        totalItems: totalLogs,
        totalPages: Math.ceil(totalLogs / limit),
      }
    });
  } catch (err) {
    logger.error('Failed to fetch admin logs:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// ─── Win Rate Control (House Settings) ───────────────────────────
router.get('/admin/house-settings', adminMiddleware, async (req: any, res) => {
  try {
    let settings = await prisma.houseSettings.findUnique({ where: { id: 1 } });
    if (!settings) {
      settings = await prisma.houseSettings.create({
        data: { id: 1, forceHouseWin: true, rouletteFix: true, bingoWinRate: 100 }
      });
    }
    res.json(settings);
  } catch (error) {
    logger.error('Failed to get house settings:', error);
    res.status(500).json({ error: 'Failed to get house settings' });
  }
});

router.post('/admin/house-settings', adminMiddleware, async (req: any, res) => {
  try {
    const { forceHouseWin, rouletteFix, bingoWinRate } = req.body;
    const settings = await prisma.houseSettings.upsert({
      where: { id: 1 },
      update: {
        forceHouseWin: Boolean(forceHouseWin),
        rouletteFix: Boolean(rouletteFix),
        bingoWinRate: Number(bingoWinRate) || 100,
      },
      create: {
        id: 1,
        forceHouseWin: Boolean(forceHouseWin),
        rouletteFix: Boolean(rouletteFix),
        bingoWinRate: Number(bingoWinRate) || 100,
      }
    });

    await prisma.adminLog.create({
      data: {
        adminId: req.user!.id,
        action: 'UPDATE_HOUSE_SETTINGS',
        details: { forceHouseWin, rouletteFix, bingoWinRate }
      }
    });

    res.json({ success: true, settings });
  } catch (error) {
    logger.error('Failed to update house settings:', error);
    res.status(500).json({ error: 'Failed to update house settings' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ONE-TIME RETROACTIVE CORRECTION ENDPOINT
// POST /admin/fix-historical-bonus
// Scans all past AgentCommissionLogs and corrects amounts that were inflated
// because bonus ETB was mistakenly counted as real cash. Refunds agent pre-deposit
// wallets for overcharged commission and reduces inflated bot debt records.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/admin/fix-historical-bonus', telegramAuthMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  logger.info('[FixHistorical] Starting retroactive bonus correction...');

  try {
    const logs = await prisma.agentCommissionLog.findMany({
      where: { type: { in: ['COMMISSION_DEBIT', 'BOT_WIN_DEBT_ADDED'] } },
      include: {
        wallet: true,
        agent: { select: { firstName: true } }
      }
    });

    const report: any[] = [];
    let totalRefunded = 0;
    let totalDebtReduced = 0;

    for (const log of logs) {
      if (!log.gameId || !log.totalSales || Number(log.totalSales) <= 0) continue;

      // If the description already contains a correction note, skip it
      if (log.description?.includes('Auto-Corrected')) continue;

      let trueRealCash = 0;

      if (log.type === 'COMMISSION_DEBIT') {
        const txs = await prisma.transaction.findMany({
          where: {
            type: 'TICKET_PURCHASE', referenceId: log.gameId,
            user: { isBot: false }, status: { in: ['completed', 'COMPLETED'] }
          }
        });
        trueRealCash = txs.reduce((sum, tx) => sum + (Number(tx.balanceBefore) - Number(tx.balanceAfter)), 0);
      } else if (log.type === 'BOT_WIN_DEBT_ADDED') {
        const txs = await prisma.transaction.findMany({
          where: {
            type: 'TICKET_PURCHASE', referenceId: log.gameId,
            user: { isBot: false, referredBy: log.agentId }, status: { in: ['completed', 'COMPLETED'] }
          }
        });
        trueRealCash = txs.reduce((sum, tx) => sum + (Number(tx.balanceBefore) - Number(tx.balanceAfter)), 0);
      }

      const recordedSales = Number(log.totalSales);
      if (trueRealCash >= recordedSales - 0.01) continue; // no bonus used, all clean

      const rate = Number(log.amount) / recordedSales;
      const newAmount = trueRealCash * rate;
      const difference = Number(log.amount) - newAmount;

      if (difference < 0.01) continue;

      // Update the log entry
      await prisma.agentCommissionLog.update({
        where: { id: log.id },
        data: {
          totalSales: trueRealCash,
          amount: newAmount,
          description: (log.description || '') + ` [Auto-Corrected: -${difference.toFixed(2)} ETB from bonus adjustment]`
        }
      });

      if (log.type === 'COMMISSION_DEBIT' && log.wallet) {
        const wallet = log.wallet;
        const newBalance = Number(wallet.balance) + difference;
        const newTotalDebited = Math.max(0, Number(wallet.totalDebited || 0) - difference);

        await prisma.agentPreDepositWallet.update({
          where: { id: wallet.id },
          data: { balance: newBalance, totalDebited: newTotalDebited }
        });

        totalRefunded += difference;
        report.push({
          type: 'REFUND',
          agentName: log.agent.firstName,
          gameId: log.gameId,
          refundedETB: difference.toFixed(2),
          note: `Commission overcharge corrected`
        });
        logger.info(`[FixHistorical] Refunded ${difference.toFixed(2)} ETB to ${log.agent.firstName} for game ${log.gameId}`);
      } else if (log.type === 'BOT_WIN_DEBT_ADDED') {
        totalDebtReduced += difference;
        report.push({
          type: 'DEBT_REDUCED',
          agentName: log.agent.firstName,
          gameId: log.gameId,
          reducedETB: difference.toFixed(2),
          note: `Bot debt overcharge corrected`
        });
        logger.info(`[FixHistorical] Reduced bot debt ${difference.toFixed(2)} ETB for ${log.agent.firstName} game ${log.gameId}`);
      }
    }

    await prisma.adminLog.create({
      data: {
        adminId: (req as any).user!.id,
        action: 'FIX_HISTORICAL_BONUS_REPORTS',
        details: { totalRefunded: totalRefunded.toFixed(2), totalDebtReduced: totalDebtReduced.toFixed(2), corrections: report.length }
      }
    });

    logger.info(`[FixHistorical] Done. Refunded ${totalRefunded.toFixed(2)} ETB, reduced debt ${totalDebtReduced.toFixed(2)} ETB, ${report.length} corrections.`);

    res.json({
      success: true,
      summary: {
        totalPhysicalRefunded: totalRefunded.toFixed(2) + ' ETB',
        totalBotDebtReduced: totalDebtReduced.toFixed(2) + ' ETB',
        totalCorrections: report.length,
      },
      corrections: report
    });
  } catch (err: any) {
    logger.error('[FixHistorical] Error:', err);
    res.status(500).json({ error: 'Failed to run historical correction', details: err.message });
  }
});

export default router;
