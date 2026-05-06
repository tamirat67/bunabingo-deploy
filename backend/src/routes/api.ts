import { Router, Request, Response } from 'express';
import { telegramAuthMiddleware, adminMiddleware } from '../middleware/auth';
import { depositLimiter, withdrawLimiter, joinGameLimiter } from '../middleware/rateLimit';
import { getOrCreateWallet } from '../services/wallet.service';
import { getUserDeposits, createDepositRequest, getPendingDeposits, approveDeposit, rejectDeposit } from '../services/deposit.service';
import { getUserWithdrawals, createWithdrawalRequest, getPendingWithdrawals, approveWithdrawal, rejectWithdrawal } from '../services/withdrawal.service';
import { getRooms, getRoomWithActiveGame, initializeRooms } from '../game/room.manager';
import { joinGame } from '../game/engine';
import { getAllUsers, suspendUser, banUser, findOrCreateUser } from '../services/user.service';
import prisma from '../lib/prisma';
import multer from 'multer';
import path from 'path';
import { config } from '../config';
import { logger } from '../lib/logger';

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

    res.json({
      id: user.id,
      firstName: user.firstName,
      telegramId: user.telegramId?.toString(),
      telegramUsername: user.telegramUsername,
      isAdmin: user.isAdmin,
      wallet
    });
  } catch (err) {
    logger.error('Wallet sync error:', err);
    res.status(500).json({ error: 'Failed to sync wallet balance' });
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
router.get('/rooms', async (_req: Request, res: Response) => {
  const rooms = await getRooms();
  res.json(rooms);
});

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
    res.status(400).json({ error: e.message });
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
    orderBy: { purchasedAt: 'asc' }
  });
  if (!tickets.length) return res.status(404).json({ error: 'No tickets found' });
  res.json({ tickets }); // Now returns an array of tickets
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

export default router;
