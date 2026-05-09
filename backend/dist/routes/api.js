"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const wallet_service_1 = require("../services/wallet.service");
const deposit_service_1 = require("../services/deposit.service");
const withdrawal_service_1 = require("../services/withdrawal.service");
const room_manager_1 = require("../game/room.manager");
const engine_1 = require("../game/engine");
const user_service_1 = require("../services/user.service");
const prisma_1 = require("../lib/prisma");
const prisma_2 = __importDefault(require("../lib/prisma"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../lib/logger");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    dest: 'uploads/',
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
        cb(null, allowed.includes(path_1.default.extname(file.originalname).toLowerCase()));
    },
});
// ─── PUBLIC Routes ─────────────────────────────────────────────
router.get('/rooms', async (_req, res) => {
    try {
        const rooms = await (0, prisma_1.withRetry)(() => prisma_2.default.room.findMany({ where: { isActive: true } }));
        res.json(rooms);
    }
    catch (err) {
        logger_1.logger.error('Failed to load rooms:', err);
        res.status(500).json({ error: 'Failed to load rooms' });
    }
});
// ─── Auth middleware for all routes below ─────────────────────
router.use(auth_1.telegramAuthMiddleware);
// ─── Registration ──────────────────────────────────────────────
router.post('/auth/register', async (req, res) => {
    const tgUser = req.tgUser;
    const { referredById } = req.body;
    try {
        const user = await (0, user_service_1.findOrCreateUser)({
            id: tgUser.id,
            username: tgUser.username,
            first_name: tgUser.first_name,
            last_name: tgUser.last_name,
        }, referredById);
        res.json({
            success: true,
            user: { ...user, telegramId: user.telegramId?.toString() },
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Registration failed' });
    }
});
router.post('/auth/verify-phone', async (req, res) => {
    const user = req.user;
    const { contact } = req.body;
    if (!user)
        return res.status(401).json({ error: 'Not authorized' });
    const phoneNumber = contact?.phoneNumber || contact?.phone_number;
    if (!phoneNumber)
        return res.status(400).json({ error: 'No phone number provided' });
    try {
        const updatedUser = await prisma_2.default.user.update({
            where: { id: user.id },
            data: { phoneNumber },
        });
        res.json({ success: true, user: updatedUser });
    }
    catch (err) {
        logger_1.logger.error('Phone verification failed:', err);
        res.status(500).json({ error: 'Verification failed' });
    }
});
// ─── User / Wallet ──────────────────────────────────────────────
router.get('/me', async (req, res) => {
    try {
        let user = req.user;
        const tgUser = req.tgUser;
        if (!user && tgUser) {
            user = await (0, user_service_1.findOrCreateUser)({
                id: tgUser.id,
                username: tgUser.username,
                first_name: tgUser.first_name,
                last_name: tgUser.last_name,
            }, tgUser.startParam);
        }
        if (!user)
            return res.status(401).json({ error: 'Not registered' });
        let wallet = await prisma_2.default.wallet.findUnique({ where: { userId: user.id } });
        if (!wallet) {
            wallet = await prisma_2.default.wallet.create({ data: { userId: user.id, balance: 0 } });
        }
        res.json({
            id: user.id,
            firstName: user.firstName,
            telegramId: user.telegramId?.toString(),
            telegramUsername: user.telegramUsername,
            isAdmin: user.isAdmin,
            wallet,
        });
    }
    catch (err) {
        logger_1.logger.error('Wallet sync error:', err);
        res.status(500).json({ error: 'Failed to sync wallet balance' });
    }
});
router.get('/me/profile', async (req, res) => {
    const user = req.user;
    try {
        const fullUser = await prisma_2.default.user.findUnique({
            where: { id: user.id },
            include: {
                wallet: true,
                _count: { select: { winners: true } },
            },
        });
        if (!fullUser)
            return res.status(404).json({ error: 'User not found' });
        const totalEarnings = await prisma_2.default.transaction.aggregate({
            where: { userId: fullUser.id, type: 'PRIZE_WIN', status: 'COMPLETED' },
            _sum: { amount: true },
        });
        res.json({
            username: fullUser.telegramUsername || fullUser.firstName || 'User',
            balance: fullUser.wallet?.balance || 0,
            gamesWon: fullUser._count.winners,
            totalCoins: totalEarnings._sum.amount || 0,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});
router.post('/me/profile', async (req, res) => {
    const user = req.user;
    const { firstName } = req.body;
    try {
        const updated = await prisma_2.default.user.update({
            where: { id: user.id },
            data: { firstName: firstName || undefined },
        });
        res.json({ success: true, user: updated });
    }
    catch (err) {
        res.status(500).json({ error: 'Update failed' });
    }
});
router.get('/wallet', async (req, res) => {
    const user = req.user;
    const wallet = await (0, wallet_service_1.getOrCreateWallet)(user.id);
    res.json(wallet);
});
router.get('/transactions', async (req, res) => {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const txns = await prisma_2.default.transaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
    });
    res.json(txns);
});
// ─── Deposits ──────────────────────────────────────────────────
router.post('/deposits', rateLimit_1.depositLimiter, upload.single('screenshot'), async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Verification required to play' });
    try {
        const { amount, reference } = req.body;
        const screenshotUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
        const deposit = await (0, deposit_service_1.createDepositRequest)(user.id, parseFloat(amount), reference, screenshotUrl);
        res.json({ success: true, deposit });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.get('/deposits', async (req, res) => {
    const user = req.user;
    const deposits = await (0, deposit_service_1.getUserDeposits)(user.id);
    res.json(deposits);
});
// ─── Withdrawals ────────────────────────────────────────────────
router.post('/withdrawals', rateLimit_1.withdrawLimiter, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Verification required to play' });
    try {
        const { amount, accountName, accountNumber, bankName } = req.body;
        const wd = await (0, withdrawal_service_1.createWithdrawalRequest)(user.id, parseFloat(amount), accountName, accountNumber, bankName);
        res.json({ success: true, withdrawal: wd });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.get('/withdrawals', async (req, res) => {
    const user = req.user;
    const wds = await (0, withdrawal_service_1.getUserWithdrawals)(user.id);
    res.json(wds);
});
// ─── Games ──────────────────────────────────────────────────────
router.post('/games/join', rateLimit_1.joinGameLimiter, async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Verification required to play' });
    try {
        const { roomType, cardIds } = req.body;
        let room = await (0, room_manager_1.getRoomWithActiveGame)(roomType);
        if (!room) {
            await (0, room_manager_1.initializeRooms)();
            room = await (0, room_manager_1.getRoomWithActiveGame)(roomType);
        }
        let gameId = room?.games[0]?.id;
        if (!gameId && room) {
            gameId = await (0, engine_1.createWaitingGame)(room.id);
        }
        if (!gameId) {
            return res.status(404).json({ error: 'Game engine is busy. Please try again.' });
        }
        const { tickets, cards } = await (0, engine_1.joinGame)(user.id, gameId, cardIds);
        res.json({ success: true, tickets, cards, gameId });
    }
    catch (e) {
        logger_1.logger.error('JOIN GAME ERROR:', e);
        res.status(400).json({ error: e.message || 'Server error during join' });
    }
});
router.get('/games/:gameId', async (req, res) => {
    const game = await prisma_2.default.game.findUnique({
        where: { id: req.params.gameId },
        include: {
            room: true,
            drawHistory: { orderBy: { sequence: 'asc' } },
            winners: { include: { user: { select: { firstName: true, telegramUsername: true } } } },
            tickets: { select: { userId: true, markedNumbers: true, isWinner: true } },
        },
    });
    if (!game)
        return res.status(404).json({ error: 'Game not found' });
    res.json(game);
});
router.get('/games/:gameId/mycard', async (req, res) => {
    const user = req.user;
    const tickets = await prisma_2.default.ticket.findMany({
        where: { userId: user.id, gameId: req.params.gameId },
        include: { winners: true },
        orderBy: { purchasedAt: 'asc' },
    });
    if (!tickets.length)
        return res.status(404).json({ error: 'No tickets found' });
    res.json({ tickets });
});
router.get('/mytickets', async (req, res) => {
    const user = req.user;
    const tickets = await prisma_2.default.ticket.findMany({
        where: { userId: user.id },
        include: { game: { include: { room: true } }, winners: true },
        orderBy: { purchasedAt: 'desc' },
        take: 20,
    });
    res.json(tickets);
});
router.get('/history', async (req, res) => {
    const user = req.user;
    const winners = await prisma_2.default.winner.findMany({
        where: { userId: user.id },
        include: { game: { include: { room: true } } },
        orderBy: { paidAt: 'desc' },
        take: 20,
    });
    res.json(winners);
});
// ─── Leaderboard ────────────────────────────────────────────────
router.get('/leaderboard', async (req, res) => {
    const timeframe = req.query.timeframe || 'today';
    let dateFilter = {};
    const now = new Date();
    if (timeframe === 'today') {
        dateFilter = { gte: new Date(now.setHours(0, 0, 0, 0)) };
    }
    else if (timeframe === 'week') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        dateFilter = { gte: d };
    }
    else if (timeframe === 'month') {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        dateFilter = { gte: d };
    }
    try {
        const topWinners = await prisma_2.default.winner.groupBy({
            by: ['userId'],
            where: { paidAt: dateFilter },
            _count: { id: true },
            _sum: { prizeAmount: true },
            orderBy: { _count: { id: 'desc' } },
            take: 100,
        });
        const enriched = await Promise.all(topWinners.map(async (w, idx) => {
            const user = await prisma_2.default.user.findUnique({
                where: { id: w.userId },
                select: { firstName: true, telegramId: true, telegramUsername: true },
            });
            const rawTgId = user?.telegramId?.toString() || '0000000000';
            const obfuscated = rawTgId.length > 5 ? rawTgId.slice(0, 5) + '**' + rawTgId.slice(-3) : rawTgId;
            return {
                id: w.userId,
                name: user?.telegramUsername || user?.firstName || 'Buna Player',
                tgId: obfuscated,
                score: w._count.id,
                amount: Number(w._sum.prizeAmount || 0),
                rank: idx + 1,
            };
        }));
        res.json(enriched);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});
// ─── Pusher Auth ─────────────────────────────────────────────────
router.post('/pusher/auth', async (req, res) => {
    const user = req.user;
    const { pusher } = await Promise.resolve().then(() => __importStar(require('../lib/pusher')));
    const { socket_id, channel_name } = req.body;
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
const adminRouter = (0, express_1.Router)();
adminRouter.use(auth_1.adminMiddleware);
adminRouter.get('/deposits/pending', async (_req, res) => {
    res.json(await (0, deposit_service_1.getPendingDeposits)());
});
adminRouter.post('/deposits/:id/approve', async (req, res) => {
    const admin = req.user;
    try {
        await (0, deposit_service_1.approveDeposit)(req.params.id, admin.id);
        res.json({ success: true });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
adminRouter.post('/deposits/:id/reject', async (req, res) => {
    const admin = req.user;
    try {
        await (0, deposit_service_1.rejectDeposit)(req.params.id, admin.id, req.body.reason || 'Rejected');
        res.json({ success: true });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
adminRouter.get('/withdrawals/pending', async (_req, res) => {
    res.json(await (0, withdrawal_service_1.getPendingWithdrawals)());
});
adminRouter.post('/withdrawals/:id/approve', async (req, res) => {
    const admin = req.user;
    try {
        await (0, withdrawal_service_1.approveWithdrawal)(req.params.id, admin.id);
        res.json({ success: true });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
adminRouter.post('/withdrawals/:id/reject', async (req, res) => {
    const admin = req.user;
    try {
        await (0, withdrawal_service_1.rejectWithdrawal)(req.params.id, admin.id, req.body.reason || 'Rejected');
        res.json({ success: true });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
adminRouter.get('/users', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    res.json(await (0, user_service_1.getAllUsers)(page));
});
adminRouter.post('/users/:id/suspend', async (req, res) => {
    const admin = req.user;
    await (0, user_service_1.suspendUser)(req.params.id, admin.id, req.body.reason || '');
    res.json({ success: true });
});
adminRouter.post('/users/:id/ban', async (req, res) => {
    const admin = req.user;
    await (0, user_service_1.banUser)(req.params.id, admin.id, req.body.reason || '');
    res.json({ success: true });
});
adminRouter.get('/analytics', async (_req, res) => {
    const [totalUsers, totalGames, totalDeposits, totalWithdrawals, pendingDeposits, pendingWithdrawals, activeGames,] = await Promise.all([
        prisma_2.default.user.count(),
        prisma_2.default.game.count({ where: { status: 'FINISHED' } }),
        prisma_2.default.deposit.aggregate({ where: { status: 'APPROVED' }, _sum: { amount: true } }),
        prisma_2.default.withdrawal.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
        prisma_2.default.deposit.count({ where: { status: 'PENDING' } }),
        prisma_2.default.withdrawal.count({ where: { status: 'PENDING' } }),
        prisma_2.default.game.count({ where: { status: { in: ['RUNNING', 'COUNTDOWN', 'WAITING'] } } }),
    ]);
    res.json({
        totalUsers, totalGames, activeGames,
        totalDeposited: totalDeposits._sum.amount,
        totalWithdrawn: totalWithdrawals._sum.amount,
        pendingDeposits, pendingWithdrawals,
    });
});
adminRouter.get('/games/active', async (_req, res) => {
    const games = await prisma_2.default.game.findMany({
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
exports.default = router;
//# sourceMappingURL=api.js.map