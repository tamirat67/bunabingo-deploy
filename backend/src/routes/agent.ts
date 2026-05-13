import { Router, Request, Response } from 'express';
import { agentMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import { approveDeposit, rejectDeposit } from '../services/deposit.service';
import { approveWithdrawal, rejectWithdrawal } from '../services/withdrawal.service';

const router = Router();

// Apply Agent middleware to all routes in this file
router.use(agentMiddleware);

/**
 * GET /api/agent/stats
 */
router.get('/stats', async (req: Request, res: Response) => {
  const agent = (req as any).user;
  
  try {
    const [
      playerCount,
      totalDeposits,
      commissionEarned
    ] = await Promise.all([
      prisma.user.count({ where: { referredBy: agent.id } }),
      prisma.deposit.aggregate({
        where: { user: { referredBy: agent.id }, status: 'approved' },
        _sum: { amount: true }
      }),
      prisma.wallet.findUnique({
        where: { userId: agent.id },
        select: { balance: true }
      })
    ]);

    res.json({
      playerCount,
      totalDeposits: totalDeposits._sum.amount || 0,
      commissionBalance: commissionEarned?.balance || 0,
    });
  } catch (err) {
    logger.error(`[AgentAPI] Failed to fetch stats for agent ${agent.id}:`, err);
    res.status(500).json({ error: 'Failed to fetch agent statistics' });
  }
});

/**
 * GET /api/agent/players
 */
router.get('/players', async (req: Request, res: Response) => {
  const agent = (req as any).user;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  try {
    const players = await prisma.user.findMany({
      where: { referredBy: agent.id },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });
    const total = await prisma.user.count({ where: { referredBy: agent.id } });
    
    res.json({
      users: players,
      total,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

/**
 * GET /api/agent/deposits/pending
 */
router.get('/deposits/pending', async (req: Request, res: Response) => {
  const agent = (req as any).user;
  try {
    const deposits = await prisma.deposit.findMany({
      where: { 
        status: 'pending',
        user: { referredBy: agent.id }
      },
      include: { user: true },
      orderBy: { createdAt: 'asc' }
    });
    res.json(deposits);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending deposits' });
  }
});

router.post('/deposits/:id/approve', async (req, res) => {
  const agent = (req as any).user;
  try {
    const deposit = await prisma.deposit.findUnique({
      where: { id: req.params.id },
      include: { user: true }
    });

    if (!deposit || deposit.user?.referredBy !== agent.id) {
      return res.status(403).json({ error: 'Unauthorized: This player is not in your branch.' });
    }

    await approveDeposit(req.params.id, agent.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/deposits/:id/reject', async (req, res) => {
  const agent = (req as any).user;
  try {
    const deposit = await prisma.deposit.findUnique({
      where: { id: req.params.id },
      include: { user: true }
    });

    if (!deposit || deposit.user?.referredBy !== agent.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await rejectDeposit(req.params.id, agent.id, req.body.reason || 'Rejected by agent');
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * GET /api/agent/withdrawals/pending
 */
router.get('/withdrawals/pending', async (req, res) => {
  const agent = (req as any).user;
  try {
    const withdrawals = await prisma.withdrawal.findMany({
      where: { 
        status: 'pending',
        user: { referredBy: agent.id }
      },
      include: { user: true },
      orderBy: { createdAt: 'asc' }
    });
    res.json(withdrawals);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending withdrawals' });
  }
});

router.post('/withdrawals/:id/approve', async (req, res) => {
  const agent = (req as any).user;
  try {
    const wd = await prisma.withdrawal.findUnique({
      where: { id: req.params.id },
      include: { user: true }
    });

    if (!wd || wd.user?.referredBy !== agent.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await approveWithdrawal(req.params.id, agent.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;

