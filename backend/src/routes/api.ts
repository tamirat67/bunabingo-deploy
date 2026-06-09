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
    const rooms = await withRetry(() => getRooms());
    res.json(rooms);
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
    const responseData = { 
      occupiedIds: otherOccupiedIds, 
      myCardIds, 
      gameId, 
      roomId: room.id, 
      playerCount,
      realPlayerCount: realUserIds.size,
      botPlayerCount: botUserIds.size,
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
      if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

      const balance = new Decimal(wallet.balance.toString());
      const bonus = new Decimal(wallet.bonusBalance.toString());
      const totalAvailable = balance.add(bonus);

      if (totalAvailable.lessThan(stake)) {
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

       let remainingToDebit = new Decimal(finalStake);
       let newBonus = new Decimal(wallet.bonusBalance.toString());
       let newBalance = new Decimal(wallet.balance.toString());

       if (!gameId) {
         // Deduct from Bonus Wallet first, then Main Wallet
         if (newBonus.greaterThan(0)) {
           const bonusToUse = Decimal.min(newBonus, remainingToDebit);
           newBonus = newBonus.sub(bonusToUse);
           remainingToDebit = remainingToDebit.sub(bonusToUse);
         }

         if (remainingToDebit.greaterThan(0)) {
           newBalance = newBalance.sub(remainingToDebit);
         }

         await tx.wallet.update({
           where: { userId: user.id },
           data: { 
             balance: newBalance,
             bonusBalance: newBonus,
             totalSpent: { increment: finalStake }
           }
         });
         
         await tx.transaction.create({
           data: {
             userId: user.id,
             type: 'TICKET_PURCHASE',
             amount: finalStake,
             balanceBefore: wallet.balance,
             balanceAfter: newBalance,
             status: 'COMPLETED',
             description: `Direct Spin: ${finalStake} ETB (Bonus Used: ${new Decimal(wallet.bonusBalance.toString()).sub(newBonus).toFixed(2)} ETB)`
           }
         });
       }
       
       if (isWin) {
         const midBalance = gameId ? new Decimal(wallet.balance.toString()) : newBalance;
         const finalBalance = midBalance.add(prizeAmount);
         
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
        'Abebe', 'Kebede', 'Selam', 'Tesfaye', 'Dawit', 'Yonas', 'Tigist', 'Almaz',
        'Meron', 'Hiwot', 'Tizita', 'Biruk', 'Nahom', 'Eyob', 'Liya', 'Saron',
        'Kalkidan', 'Robel', 'Bethel', 'Henok', 'Rahel', 'Tsion', 'Abel', 'Eden',
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
  
  res.json({
    ...gameData,
    countdownSeconds: state?.secondsRemaining ?? gameData.countdownSeconds,
    currentPlayers: state?.secondsRemaining !== undefined ? _count.tickets : gameData.currentPlayers,
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
          'Abebe', 'Kebede', 'Selam', 'Tesfaye', 'Dawit', 'Yonas', 'Tigist', 'Almaz',
          'Meron', 'Hiwot', 'Tizita', 'Biruk', 'Nahom', 'Eyob', 'Liya', 'Saron',
          'Kalkidan', 'Robel', 'Bethel', 'Henok', 'Rahel', 'Tsion', 'Abel', 'Eden',
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
      userFilter = { referredBy: 'no-agents-assigned' };
    }
  } else if (!user.isAdmin && user.role !== 'ADMIN') {
    userFilter = { referredBy: user.id };
  }

  try {
    const [
      pendingDeps,
      pendingWds,
      approvedDepsAgg,
      completedWdsAgg
    ] = await Promise.all([
      prisma.deposit.aggregate({
        where: { status: { in: ['pending', 'PENDING'] }, user: userFilter },
        _sum: { amount: true },
        _count: { id: true }
      }),
      prisma.withdrawal.aggregate({
        where: { status: { in: ['pending', 'PENDING'] }, user: userFilter },
        _sum: { amount: true },
        _count: { id: true }
      }),
      prisma.deposit.aggregate({
        where: { status: { in: ['approved', 'completed', 'APPROVED', 'COMPLETED'] }, user: userFilter },
        _sum: { amount: true }
      }),
      prisma.withdrawal.aggregate({
        where: { status: { in: ['approved', 'completed', 'APPROVED', 'COMPLETED'] }, user: userFilter },
        _sum: { amount: true }
      })
    ]);

    res.json({
      pendingDepositsCount: pendingDeps._count.id || 0,
      pendingDepositsSum: Number(pendingDeps._sum.amount || 0),
      pendingWithdrawalsCount: pendingWds._count.id || 0,
      pendingWithdrawalsSum: Number(pendingWds._sum.amount || 0),
      totalDeposited: Number(approvedDepsAgg._sum.amount || 0),
      totalWithdrawn: Number(completedWdsAgg._sum.amount || 0)
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
  const limit = 20;

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
          prisma.user.findMany({ where, skip, take: limit, include: { wallet: true, referrer: { select: { id: true, firstName: true, telegramUsername: true, referralCode: true } } }, orderBy: { createdAt: 'desc' } }),
          prisma.user.count({ where }),
        ]);
        res.json({ users, total, pages: Math.ceil(total / limit) });
      } else if (referredByFilter) {
        // Show players under a specific agent
        const { getPlayersUnderAgent } = await import('../services/user.service');
        res.json(await getPlayersUnderAgent(referredByFilter, page, limit, search));
      } else {
        // No filter — show everyone
        res.json(await getAllUsers(page, limit, search));
      }
    } else {
      // Agents only see their own referred players
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
      agentIds = ['no-agents-assigned'];
    }
  }

  const { getAgents } = await import('../services/user.service');
  res.json(await getAgents(page, 20, agentIds));
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

    // Only real (non-bot) referred users
    const referredUserIds = agent.referrals.filter((r: any) => !r.isBot).map((r: any) => r.id);
    const realPlayers = agent.referrals.filter((r: any) => !r.isBot);
    const botPlayers = agent.referrals.filter((r: any) => r.isBot);

    const [
      totalDepositsAgg,
      pendingDepositsAgg,
      totalTicketSalesAgg,
      totalWithdrawalsAgg,
      recentTransactions,
      recentDeposits,
      gameCount,
      rechargeHistory,
    ] = await Promise.all([
      prisma.deposit.aggregate({
        where: { status: 'APPROVED', userId: { in: referredUserIds } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.deposit.aggregate({
        where: { status: { in: ['PENDING', 'pending'] }, userId: { in: referredUserIds } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'TICKET_PURCHASE', status: { in: ['completed', 'COMPLETED'] }, userId: { in: referredUserIds } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.withdrawal.aggregate({
        where: { status: { in: ['APPROVED', 'COMPLETED', 'approved', 'completed'] }, userId: { in: referredUserIds } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.transaction.findMany({
        where: { userId: { in: referredUserIds } },
        include: { user: { select: { firstName: true, telegramUsername: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.deposit.findMany({
        where: { userId: { in: referredUserIds } },
        include: { user: { select: { firstName: true, telegramUsername: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.game.count({
        where: { tickets: { some: { userId: { in: referredUserIds } } } },
      }),
      // Recharge history for this agent's pre-deposit wallet
      prisma.agentCommissionLog.findMany({
        where: { agentId, type: 'RECHARGE' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, amount: true, createdAt: true, description: true }
      }),
    ]);

    const { getAgentPreDepositStatus } = await import('../services/agentPreDeposit.service');
    const { getAgentProfitRate } = await import('../services/settings.service');
    const preDepositStatus = await getAgentPreDepositStatus(agentId);
    const profitRate = await getAgentProfitRate();

    const totalSales = Number(totalTicketSalesAgg._sum.amount || 0);
    const netProfit = totalSales * profitRate;

    res.json({
      agent: {
        id: agent.id,
        firstName: agent.firstName,
        telegramUsername: agent.telegramUsername,
        telegramId: agent.telegramId,
        phone: agent.phone,
        role: agent.role,
        createdAt: agent.createdAt,
        depositPhones: agent.depositPhones,
      },
      preDepositStatus,
      wallet: agent.wallet,
      stats: {
        totalPlayers: referredUserIds.length,
        totalDeposited: Number(totalDepositsAgg._sum.amount || 0),
        totalDepositsCount: totalDepositsAgg._count.id,
        pendingDeposits: Number(pendingDepositsAgg._sum.amount || 0),
        pendingDepositsCount: pendingDepositsAgg._count.id,
        totalTicketSales: totalSales,
        totalTicketsCount: totalTicketSalesAgg._count.id,
        totalWithdrawn: Number(totalWithdrawalsAgg._sum.amount || 0),
        totalWithdrawalsCount: totalWithdrawalsAgg._count.id,
        netProfit,
        profitRate,
        gamesPlayed: gameCount,
      },
      players: realPlayers,
      botCount: botPlayers.length,
      recentTransactions,
      recentDeposits,
      rechargeHistory,
    });
  } catch (err: any) {
    logger.error('[Agent Report]', err);
    res.status(500).json({ error: err.message || 'Failed to generate agent report' });
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
  const dateStr = req.query.date as string; // Optional date 'YYYY-MM-DD'
  const agentIdQuery = req.query.agentId as string; // Optional agent filter
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
      agentIds = ['no-agents-assigned'];
    }
  }

  let todayStart = new Date();
  if (dateStr) {
    todayStart = new Date(dateStr);
  }
  todayStart.setHours(0,0,0,0);
  
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23,59,59,999);

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
    prisma.deposit.aggregate({ where: { status: 'APPROVED', ...txFilter }, _sum: { amount: true } }),
    prisma.withdrawal.aggregate({ where: { status: 'COMPLETED', ...txFilter }, _sum: { amount: true } }),
    prisma.deposit.count({ where: { status: 'PENDING', ...txFilter } }),
    prisma.withdrawal.count({ where: { status: 'PENDING', ...txFilter } }),
    prisma.transaction.aggregate({ 
      where: { type: 'TICKET_PURCHASE', status: 'COMPLETED', ...txFilter }, 
      _sum: { amount: true } 
    }),
    prisma.agentCommissionLog.aggregate({ 
      where: { type: 'COMMISSION_DEBIT', ...commFilter }, 
      _sum: { amount: true } 
    }),
    // Today's Sales (Gross Volume)
    prisma.transaction.aggregate({
      where: { type: 'TICKET_PURCHASE', status: 'COMPLETED', createdAt: { gte: todayStart, lte: todayEnd }, ...txFilter },
      _sum: { amount: true }
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
      status: 'COMPLETED',
      user: { isBot: false },
      ...(agentIds ? { user: { referredBy: { in: agentIds }, isBot: false } } : {})
    },
    _sum: { amount: true }
  });
  // Bot sales = ticket purchases by bot users (synthetic/fake stake)
  const botSalesAgg = await prisma.transaction.aggregate({
    where: {
      type: 'TICKET_PURCHASE',
      status: 'COMPLETED',
      user: { isBot: true },
      ...(agentIds ? { user: { referredBy: { in: agentIds }, isBot: true } } : {})
    },
    _sum: { amount: true }
  });

  // House Bot Advantage: bot wins kept in system
  const botWinnerRecords = await prisma.winner.aggregate({
    where: {
      user: { isBot: true },
      ...(agentIds ? { user: { referredBy: { in: agentIds }, isBot: true } } : {})
    },
    _sum: { prizeAmount: true },
    _count: { id: true },
  });

  const realGrossSales = Number(realSalesAgg._sum.amount || 0);
  const botGrossSales  = Number(botSalesAgg._sum.amount || 0);
  const botWinPayoutAmount = Number(botWinnerRecords._sum?.prizeAmount || 0);
  const botWinCount = Number(botWinnerRecords._count?.id || 0);

  // Dynamic Revenue Split Settings
  const { getAgentProfitRate, getCompanyCommissionRate } = await import('../services/settings.service');
  const agentRate = await getAgentProfitRate(); // e.g. 0.06 (6%)
  const companyRate = await getCompanyCommissionRate(); // e.g. 0.30 (30%)

  const AGENT_RATE = agentRate;
  const COMPANY_RATE = Math.max(0, companyRate - agentRate);

  // Breakdown using dynamic companyRate (fixes hardcoded 0.25 bug)
  const breakdown = Object.keys(roomStats).map(key => ({
    gameType: key,
    entryFee: roomStats[key].ticketPrice,
    totalStake: roomStats[key].totalStake,
    serviceFee: roomStats[key].totalStake * companyRate
  }));

  const realCompanyRevenue = realGrossSales * COMPANY_RATE;
  const realAgentRevenue   = realGrossSales * AGENT_RATE;
  const botCompanyRevenue  = botGrossSales  * COMPANY_RATE;  // synthetic — NOT real profit

  const todayGlobalSales = Number(globalSalesTodayAgg._sum.amount || 0);
  // Today's real sales (non-bot tickets purchased today)
  const todayRealSalesAgg = await prisma.transaction.aggregate({
    where: {
      type: 'TICKET_PURCHASE',
      status: 'COMPLETED',
      user: { isBot: false },
      createdAt: { gte: todayStart, lte: todayEnd },
      ...(agentIds ? { user: { referredBy: { in: agentIds }, isBot: false } } : {})
    },
    _sum: { amount: true }
  });
  const todayRealSales = Number(todayRealSalesAgg._sum.amount || 0);
  const todayCompanyRevenue = todayRealSales * COMPANY_RATE;
  const todayAgentRevenue   = todayRealSales * AGENT_RATE;

  res.json({
    totalUsers,
    totalGames: totalGamesAllTime,
    activeGames,
    totalDeposited: totalDepositsAllTime._sum.amount || 0,
    totalWithdrawn: totalWithdrawalsAllTime._sum.amount || 0,
    pendingDeposits,
    pendingWithdrawals,
    globalSales: globalSalesAllTimeAgg._sum.amount || 0,
    totalCompanyRevenue: totalCompanyRevenueAllTimeAgg._sum.amount || 0,
    preDepositBalance: totalPreDepositBalance,
    preDepositAdded: totalPreDepositAdded,
    bunaWalletBalance,
    // Dynamic rates for frontend display
    companyRevenueRate: COMPANY_RATE * 100,
    agentRevenueRate: AGENT_RATE * 100,
    companyCommissionRate: companyRate * 100,
    // ── Real vs Bot breakdown (all-time, key for admin accounting) ──
    realGrossSales,           // real player ticket sales (real ETB)
    botGrossSales,            // house bot ticket sales (synthetic ETB)
    realCompanyRevenue,       // actual company profit
    realAgentRevenue,         // actual agent profit
    botCompanyRevenue,        // synthetic/fake (NOT real profit)
    botWinPayoutAmount,       // House Advantage: total bot wins kept in system
    botWinCount,              // House Advantage: number of bot wins
    // Today's values (computed from real sales only)
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
    ] = await Promise.all([
      // Count of tickets purchased by bots
      prisma.ticket.count({ where: { user: { isBot: true } } }),
      // Sum of ETB bot tickets represent
      prisma.transaction.aggregate({
        where: { type: 'TICKET_PURCHASE', status: 'COMPLETED', user: { isBot: true } },
        _sum: { amount: true }
      }),
      // Sum of ETB real player tickets represent
      prisma.transaction.aggregate({
        where: { type: 'TICKET_PURCHASE', status: 'COMPLETED', user: { isBot: false } },
        _sum: { amount: true }
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
      // Bot winner records: the engine NEVER credits bots a WIN transaction.
      // Instead we query the Winner table for rows where winner user isBot=true
      // and sum prizeAmount — this is the prize that STAYED in the system reserve.
      prisma.winner.aggregate({
        where: { user: { isBot: true } },
        _sum: { prizeAmount: true },
        _count: { id: true },
      }),
    ]);

    const totalBotSales = Number(totalBotSalesAgg._sum.amount || 0);
    const totalRealSales = Number(totalRealSalesAgg._sum.amount || 0);
    const totalAllSales = Number(totalAllSalesAgg._sum.amount || 0);
    // House bot win COUNT from gameCycle tracker
    const botWinPayouts = Number(houseBotWinsAgg._sum.houseWins || 0);
    // House bot win PRIZE AMOUNT: from Winner table where user.isBot=true.
    // NOTE: The game engine deliberately skips crediting the bot wallet (see engine.ts line 988).
    // So this prizeAmount is the money that STAYED in the system reserve — it is the house advantage.
    const botWinPayoutAmount = Number(botWinnerRecords._sum?.prizeAmount || 0);
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
            _sum: { amount: true }
          }),
        ]);
        const dayBotSales  = Number(dayBotSalesAgg._sum.amount || 0);
        const dayRealSales = Number(dayRealSalesAgg._sum.amount || 0);
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
    const { getCompanyCommissionRate } = await import('../services/settings.service');
    
    const [
      bunaWallet,
      houseBotWinsAgg,
      totalSalesAgg,
      commissionsAgg,
      agentsCount,
      totalDepositsAgg,
      totalWithdrawalsAgg,
      rate,
      realSalesAgg,
      botSalesAgg,
      agentPreDepositAgg
    ] = await Promise.all([
      prisma.systemWallet.findUnique({ where: { id: 1 } }),
      prisma.gameCycle.aggregate({ _sum: { houseWins: true } }),
      prisma.transaction.aggregate({ where: { type: 'TICKET_PURCHASE', status: 'COMPLETED' }, _sum: { amount: true } }),
      prisma.agentCommissionLog.aggregate({ where: { type: 'COMMISSION_DEBIT' }, _sum: { amount: true } }),
      prisma.user.count({ where: { role: 'AGENT' } }),
      prisma.deposit.aggregate({ where: { status: 'APPROVED' }, _sum: { amount: true } }),
      prisma.withdrawal.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
      getCompanyCommissionRate(),
      prisma.transaction.aggregate({ where: { type: 'TICKET_PURCHASE', status: 'COMPLETED', user: { isBot: false } }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { type: 'TICKET_PURCHASE', status: 'COMPLETED', user: { isBot: true } }, _sum: { amount: true } }),
      prisma.agentPreDepositWallet.aggregate({ _sum: { totalRecharged: true, totalDebited: true, balance: true } })
    ]);

    const totalSales = Number(totalSalesAgg._sum.amount || 0);
    const realPlayerSales = Number(realSalesAgg._sum.amount || 0);
    const botSales = Number(botSalesAgg._sum.amount || 0);
    const totalCommissionsDeducted = Number(commissionsAgg._sum.amount || 0);
    const expectedCommissions = realPlayerSales * rate;

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
        totalDeposits: Number(totalDepositsAgg._sum.amount || 0),
        totalWithdrawals: Number(totalWithdrawalsAgg._sum.amount || 0),
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

export default router;
