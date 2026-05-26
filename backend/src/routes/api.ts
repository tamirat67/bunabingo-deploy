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
      referralsCount,
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
          status: 'FINISHED',
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
      try {
        // Find or create a next WAITING game for the room so the player can queue
        const nextGameId = await createWaitingGame(e.roomId || (await prisma.room.findFirst({ where: { type: req.body.roomType as any, isActive: true } }))?.id || '');
        logger.info(`[JOIN] Game in progress — queued player ${(req as any).user?.id} for next game ${nextGameId}`);
        return res.status(202).json({
          error: 'GAME_IN_PROGRESS',
          message: 'A game is currently in progress. Your cartelas are reserved for the next session!',
          nextGameId,
        });
      } catch (innerErr) {
        logger.error('Failed to find next waiting game:', innerErr);
      }
    }
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
const occupiedCache = new Map<string, { data: any; timestamp: number }>();
const OCCUPIED_CACHE_DURATION_MS = 1500; // 1.5 seconds cache

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
  if (cached && (now - cached.timestamp < OCCUPIED_CACHE_DURATION_MS)) {
    return res.json(cached.data);
  }

  try {
    let gameId: string | undefined;
    let room: any;
    let isGameRunning = false;

    if (gameIdFromQuery) {
      room = await prisma.room.findFirst({ where: { type: type as any } });
      // Check if the requested game is RUNNING — if so, resolve to the next WAITING game
      const requestedGame = await prisma.game.findUnique({ where: { id: gameIdFromQuery }, select: { status: true, roomId: true } });
      if (requestedGame && (requestedGame.status === 'RUNNING' || requestedGame.status === 'FINISHED')) {
        if (requestedGame.status === 'RUNNING') {
          isGameRunning = true;
        }
        // Find or auto-create the next WAITING game for this room
        const nextWaiting = await prisma.game.findFirst({
          where: { roomId: requestedGame.roomId, status: 'WAITING' },
          orderBy: { createdAt: 'desc' },
        });
        gameId = nextWaiting?.id;
        if (!gameId) {
          const { createWaitingGame } = await import('../game/engine');
          gameId = await createWaitingGame(requestedGame.roomId);
        }
      } else {
        gameId = gameIdFromQuery;
      }
    } else {
      room = await getRoomWithActiveGame(type as any);
      gameId = room?.games[0]?.id;
      if (room) {
        const runningGame = await prisma.game.findFirst({
          where: { roomId: room.id, status: 'RUNNING' }
        });
        if (runningGame) {
          isGameRunning = true;
        }
      }
    }
    
    if (!gameId || !room) {
      const responseData = { occupiedIds: [], myCardIds: [], isGameRunning: false };
      occupiedCache.set(cacheKey, { data: responseData, timestamp: now });
      return res.json(responseData);
    }

    const tickets = await prisma.ticket.findMany({
      where: { gameId },
      select: { card: true, userId: true }
    });

    const myCardIds = user ? tickets.filter(t => t.userId === user.id).map(t => (t.card as any).id) : [];
    const otherOccupiedIds = user 
      ? tickets.filter(t => t.userId !== user.id).map(t => (t.card as any).id) 
      : tickets.map(t => (t.card as any).id);

    const playerCount = new Set(tickets.map(t => t.userId)).size;
    const responseData = { 
      occupiedIds: otherOccupiedIds, 
      myCardIds, 
      gameId, 
      roomId: room.id, 
      playerCount,
      isGameRunning,
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
        include: {
          user: { select: { firstName: true, telegramUsername: true } },
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
  const agentId = (admin.isAdmin || admin.role === 'ADMIN') ? undefined : admin.id;
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
  const agentId = (admin.isAdmin || admin.role === 'ADMIN') ? undefined : admin.id;
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

staffRouter.get('/transactions/summary', async (req, res) => {
  const user = (req as any).user;
  const userFilter = (user.isAdmin || user.role === 'ADMIN') ? {} : { referredBy: user.id };

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
  const limit = 20;

  try {
    if (user.isAdmin || user.role === 'ADMIN') {
      // Admins see everyone, with optional search
      res.json(await getAllUsers(page, limit, search));
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

staffRouter.patch('/agents/:id/deposit-phones', restrictToAdmin, async (req, res) => {
  try {
    const { depositPhones } = req.body;
    if (!Array.isArray(depositPhones)) {
      return res.status(400).json({ error: 'depositPhones must be an array' });
    }
    await prisma.user.update({
      where: { id: req.params.id },
      data: { depositPhones },
    });
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
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Demotion failed' });
  }
});

// ─── Edit User (Admin Only) ──────────────────────────────────
staffRouter.patch('/users/:id', restrictToAdmin, async (req, res) => {
  try {
    const { firstName, telegramUsername, phone, status, walletBalance } = req.body;
    const updateData: any = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (telegramUsername !== undefined) updateData.telegramUsername = telegramUsername;
    if (phone !== undefined) updateData.phone = phone;
    if (status !== undefined) updateData.status = status;

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
      await prisma.agentPreDepositWallet.updateMany({
        where: { agentId: req.params.id },
        data: { balance: parseFloat(preDepositBalance) },
      });
    }

    res.json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update agent' });
  }
});

staffRouter.get('/analytics', restrictToAdmin, async (req, res) => {
  const dateStr = req.query.date as string; // Optional date 'YYYY-MM-DD'
  let todayStart = new Date();
  if (dateStr) {
    todayStart = new Date(dateStr);
  }
  todayStart.setHours(0,0,0,0);
  
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23,59,59,999);

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
    walletsAgg,
    bunaWallet
  ] = await Promise.all([
    prisma.user.count(),
    prisma.game.count({ where: { status: 'FINISHED' } }),
    prisma.game.count({ where: { status: { in: ['RUNNING', 'COUNTDOWN', 'WAITING'] } } }),
    prisma.deposit.aggregate({ where: { status: 'APPROVED' }, _sum: { amount: true } }),
    prisma.withdrawal.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.deposit.count({ where: { status: 'PENDING' } }),
    prisma.withdrawal.count({ where: { status: 'PENDING' } }),
    prisma.transaction.aggregate({ 
      where: { type: 'TICKET_PURCHASE', status: 'COMPLETED' }, 
      _sum: { amount: true } 
    }),
    prisma.agentCommissionLog.aggregate({ 
      where: { type: 'COMMISSION_DEBIT' }, 
      _sum: { amount: true } 
    }),
    // Today's Sales (Gross Volume)
    prisma.transaction.aggregate({
      where: { type: 'TICKET_PURCHASE', status: 'COMPLETED', createdAt: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true }
    }),
    // Today's Company Revenue
    prisma.agentCommissionLog.aggregate({
      where: { type: 'COMMISSION_DEBIT', createdAt: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true }
    }),
    // Distinct players active today
    prisma.transaction.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: todayStart, lte: todayEnd } }
    }),
    // Games played today
    prisma.game.count({
      where: { createdAt: { gte: todayStart, lte: todayEnd } }
    }),
    // Tickets purchased today for room breakdown
    prisma.ticket.findMany({
      where: { purchasedAt: { gte: todayStart, lte: todayEnd } },
      include: {
        game: {
          include: {
            room: true
          }
        }
      }
    }),
    // Pre-deposit wallets sum (ONLY for default agent Luel1616)
    prisma.user.findFirst({
      where: { telegramUsername: 'Luel1616' },
      select: { agentPreDepositWallet: true }
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

  const breakdown = Object.keys(roomStats).map(key => ({
    gameType: key,
    entryFee: roomStats[key].ticketPrice,
    totalStake: roomStats[key].totalStake,
    serviceFee: roomStats[key].totalStake * 0.25
  }));

  const defaultAgentWallet = (walletsAgg as any)?.agentPreDepositWallet;
  const totalPreDepositBalance = Number(defaultAgentWallet?.balance || 0);
  const totalPreDepositDebited = Number(defaultAgentWallet?.totalDebited || 0);
  const totalPreDepositAdded = totalPreDepositBalance + totalPreDepositDebited;
  const bunaWalletBalance = Number(bunaWallet?.balance || 0);

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
    
    // Today's values
    today: {
      globalSales: globalSalesTodayAgg._sum.amount || 0,
      totalCompanyRevenue: totalCompanyRevenueTodayAgg._sum.amount || 0,
      activePlayers: activePlayersTodayCount.length,
      activeGames: activeGamesTodayCount,
      breakdown
    }
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
staffRouter.post('/promotions', restrictToAdmin, upload.single('image'), async (req, res) => {
  const { title, message, type, scheduledAt, expiresAt, isActive } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }
  
  const parseDate = (val: any) => (val && val !== 'null' && val !== 'undefined' && val !== '' ? new Date(val) : null);
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

      broadcastMessage(formattedMessage, promotion.imageUrl).catch((err) => {
        console.error(`[Broadcast] Background broadcast failed for newly created promotion ${promotion.id}:`, err);
      });
    }

    res.json(promotion);
  } catch (err) {
    console.error('Promotion creation error:', err);
    res.status(500).json({ error: 'Failed to create promotion' });
  }
});

// UPDATE a promotion
staffRouter.patch('/promotions/:id', restrictToAdmin, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { title, message, type, scheduledAt, expiresAt, isActive, removeImage } = req.body;
  
  const parseDate = (val: any) => (val && val !== 'null' && val !== 'undefined' && val !== '' ? new Date(val) : null);
  
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
    res.json(promotion);
  } catch (err) {
    console.error('Promotion update error:', err);
    res.status(500).json({ error: 'Failed to update promotion' });
  }
});

// DELETE a promotion
staffRouter.delete('/promotions/:id', restrictToAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.promotion.delete({ where: { id } });
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

    broadcastMessage(formattedMessage, promotion.imageUrl).catch((err) => {
      console.error(`[Broadcast] Background broadcast failed for promotion ${id}:`, err);
    });

    // Get total recipient count for response
    const totalRecipients = await prisma.user.count();

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
  if (!['ADMIN', 'AGENT'].includes(role)) {
    return res.status(400).json({ error: 'Role must be ADMIN or AGENT.' });
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

export default router;
