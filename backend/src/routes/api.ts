import { Router, Request, Response } from 'express';
import { telegramAuthMiddleware, adminMiddleware } from '../middleware/auth';
import { depositLimiter, withdrawLimiter, joinGameLimiter } from '../middleware/rateLimit';
import { getOrCreateWallet, convertCoinsToBonus, COINS_PER_ETB } from '../services/wallet.service';
import { getUserDeposits, createDepositRequest, getPendingDeposits, approveDeposit, rejectDeposit } from '../services/deposit.service';
import { getUserWithdrawals, createWithdrawalRequest, getPendingWithdrawals, approveWithdrawal, rejectWithdrawal } from '../services/withdrawal.service';
import { getRooms, getRoomWithActiveGame, initializeRooms } from '../game/room.manager';
import { joinGame, createWaitingGame } from '../game/engine';
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

  // Phone number is now optional for basic registration

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
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
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
      data: { phoneNumber }
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

    // Ensure wallet exists with test bankroll
    let wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
    if (!wallet) {
      wallet = await prisma.wallet.create({ data: { userId: user.id, balance: 1000 } });
    } else if (Number(wallet.balance) < 100) {
      wallet = await prisma.wallet.update({
        where: { userId: user.id },
        data: { balance: 1000 }
      });
    }

    const jackpot = await getJackpot();

    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName ?? null,
      phoneNumber: user.phoneNumber ?? null,
      telegramId: user.telegramId?.toString(),
      telegramUsername: user.telegramUsername,
      isAdmin: user.isAdmin,
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
  } catch (err) {
    logger.error('Wallet sync error:', err);
    res.status(500).json({ error: 'Failed to sync wallet balance' });
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
      bonusBalance: 0,
      gamesWon: fullUser._count.winners,
      totalCoins: totalEarnings._sum.amount || 0
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
        // We'll store phone in a custom field if we add it, but for now just update firstName
        // If we want to store phone, we'd need a field in schema.
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
    const wd = await createWithdrawalRequest(user.id, parseFloat(amount), accountName, accountNumber, bankName);
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
    
    // Self-healing: Ensure room exists and has a joinable game
    let room = await getRoomWithActiveGame(roomType as any);
    
    if (!room) {
       await initializeRooms();
       room = await getRoomWithActiveGame(roomType as any);
    }

    let gameId = room?.games[0]?.id;
    if (!gameId && room) {
       // If no game is waiting, create one now!
       gameId = await createWaitingGame(room.id);
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

// ─── Get Occupied Cards for Room ────────────────────────────
router.get('/rooms/:type/occupied', async (req: Request, res: Response) => {
  const { type } = req.params;
  try {
    const room = await getRoomWithActiveGame(type as any);
    const gameId = room?.games[0]?.id;
    if (!gameId) return res.json({ occupiedIds: [] });

    const tickets = await prisma.ticket.findMany({
      where: { gameId },
      select: { card: true }
    });

    const occupiedIds = tickets.map(t => (t.card as any).id);
    res.json({ occupiedIds, gameId, roomId: room.id });
  } catch (e: any) {
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
    
    const drawnNumbers = game.drawHistory.map(d => d.number);
    let won = false;
    
    for (const ticket of tickets) {
      const cardData = ticket.card as any;
      const rows = Array.isArray(cardData) ? cardData : cardData.rows;
      const result = checkWin(rows as any, drawnNumbers);
      if (result.won) {
        won = true;
        break;
      }
    }
    
    res.json({ success: true, won });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
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
      tickets: { select: { userId: true, markedNumbers: true, isWinner: true } },
    },
  });
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
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

// ─── Pusher Auth (private channels) ──────────────────────────
router.post('/pusher/auth', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { pusher } = await import('../lib/pusher');
  const { socket_id, channel_name } = req.body;

  // Only allow auth for user's own channel or game channels
  const isUserChannel = channel_name === `private-user-${user.id}`;
  const isGameChannel = channel_name.startsWith('private-game-');
  const isAdminChannel = channel_name === 'private-admin-channel' && user.isAdmin;

  if (!isUserChannel && !isGameChannel && !isAdminChannel) {
    return res.status(403).json({ error: 'Unauthorized channel' });
  }

  const auth = pusher.authorizeChannel(socket_id, channel_name);
  res.json(auth);
});

// ─── Admin Routes ─────────────────────────────────────────────
const adminRouter = Router();
adminRouter.use(adminMiddleware);

adminRouter.get('/deposits/pending', async (_req, res) => {
  res.json(await getPendingDeposits());
});
adminRouter.post('/deposits/:id/approve', async (req, res) => {
  const admin = (req as any).user;
  try {
    await approveDeposit(req.params.id, admin.id);
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
adminRouter.post('/deposits/:id/reject', async (req, res) => {
  const admin = (req as any).user;
  try {
    await rejectDeposit(req.params.id, admin.id, req.body.reason || 'Rejected');
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

adminRouter.get('/withdrawals/pending', async (_req, res) => {
  res.json(await getPendingWithdrawals());
});
adminRouter.post('/withdrawals/:id/approve', async (req, res) => {
  const admin = (req as any).user;
  try {
    await approveWithdrawal(req.params.id, admin.id);
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
adminRouter.post('/withdrawals/:id/reject', async (req, res) => {
  const admin = (req as any).user;
  try {
    await rejectWithdrawal(req.params.id, admin.id, req.body.reason || 'Rejected');
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

adminRouter.get('/users', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  res.json(await getAllUsers(page));
});
adminRouter.post('/users/:id/suspend', async (req, res) => {
  const admin = (req as any).user;
  await suspendUser(req.params.id, admin.id, req.body.reason || '');
  res.json({ success: true });
});
adminRouter.post('/users/:id/ban', async (req, res) => {
  const admin = (req as any).user;
  await banUser(req.params.id, admin.id, req.body.reason || '');
  res.json({ success: true });
});

// ─── Agent Management (Admin Only) ──────────────────────────
adminRouter.get('/agents', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const { getAgents } = await import('../services/user.service');
  res.json(await getAgents(page));
});

adminRouter.post('/users/:id/promote', async (req, res) => {
  const admin = (req as any).user;
  const { promoteToAgent } = await import('../services/user.service');
  try {
    await promoteToAgent(req.params.id, admin.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Promotion failed' });
  }
});

adminRouter.post('/users/:id/demote', async (req, res) => {
  const admin = (req as any).user;
  const { demoteFromAgent } = await import('../services/user.service');
  try {
    await demoteFromAgent(req.params.id, admin.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Demotion failed' });
  }
});

adminRouter.get('/analytics', async (_req, res) => {
  const [
    totalUsers, totalGames, totalDeposits, totalWithdrawals,
    pendingDeposits, pendingWithdrawals, activeGames
  ] = await Promise.all([
    prisma.user.count(),
    prisma.game.count({ where: { status: 'FINISHED' } }),
    prisma.deposit.aggregate({ where: { status: 'APPROVED' }, _sum: { amount: true } }),
    prisma.withdrawal.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.deposit.count({ where: { status: 'PENDING' } }),
    prisma.withdrawal.count({ where: { status: 'PENDING' } }),
    prisma.game.count({ where: { status: { in: ['RUNNING', 'COUNTDOWN', 'WAITING'] } } }),
  ]);
  res.json({
    totalUsers, totalGames, activeGames,
    totalDeposited: totalDeposits._sum.amount,
    totalWithdrawn: totalWithdrawals._sum.amount,
    pendingDeposits, pendingWithdrawals,
  });
});

adminRouter.get('/games/active', async (_req, res) => {
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

router.use('/admin', adminRouter);

// ─── Agent Routes ─────────────────────────────────────────────
import agentRouter from './agent';
router.use('/agent', agentRouter);

// ─── Auth Routes ──────────────────────────────────────────────


export default router;
