import { Router, Request, Response } from 'express';
import { agentMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import { approveDeposit, rejectDeposit } from '../services/deposit.service';
import { approveWithdrawal, rejectWithdrawal, getPendingWithdrawals } from '../services/withdrawal.service';
import { getAgentPreDepositStatus, getAgentCommissionHistory } from '../services/agentPreDeposit.service';
import { Decimal } from '@prisma/client/runtime/library';
import { config } from '../config';
import { getAgentProfitRate } from '../services/settings.service';

const router = Router();

// Apply Agent middleware to all routes in this file
router.use(agentMiddleware);

/**
 * GET /api/agent/stats
 */
router.get('/stats', async (req: Request, res: Response) => {
  const agent = (req as any).user;
  
  try {
    const dateStr = req.query.date as string;
    let todayStart = new Date();
    if (dateStr) {
      todayStart = new Date(dateStr);
    }
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23,59,59,999);

    const [
      playerCount,
      totalDeposits,
      totalSalesAgg,
      totalCommissionPaidAgg,
      preDepositStatus,
      wallet,
      activePlayersToday,
      activeGames
    ] = await Promise.all([
      prisma.user.count({ where: { referredBy: agent.id } }),
      prisma.deposit.aggregate({
        where: { user: { referredBy: agent.id }, status: 'approved' },
        _sum: { amount: true }
      }),
      // Total Sales = Total spent on tickets by players under this agent during selected date
      // Use case-insensitive status match to handle both 'completed' and 'COMPLETED'
      prisma.transaction.aggregate({
        where: { 
          user: { referredBy: agent.id }, 
          type: 'TICKET_PURCHASE',
          status: { in: ['completed', 'COMPLETED'] },
          createdAt: { gte: todayStart, lte: todayEnd }
        },
        _sum: { amount: true }
      }),
      // Net Commission Paid = Total company commission amounts debited from agent's pre-deposit wallet during selected date
      prisma.agentCommissionLog.aggregate({
        where: { 
          agentId: agent.id, 
          type: 'COMMISSION_DEBIT',
          createdAt: { gte: todayStart, lte: todayEnd }
        },
        _sum: { amount: true }
      }),
      getAgentPreDepositStatus(agent.id),
      prisma.agentPreDepositWallet.findUnique({
        where: { agentId: agent.id }
      }),
      // Distinct players active under this agent today
      prisma.transaction.groupBy({
        by: ['userId'],
        where: {
          user: { referredBy: agent.id },
          createdAt: { gte: todayStart, lte: todayEnd }
        }
      }),
      // Global active games
      prisma.game.count({
        where: { status: { in: ['RUNNING', 'COUNTDOWN', 'WAITING'] } }
      })
    ]);

    const totalSales = totalSalesAgg._sum.amount || new Decimal(0);
    const netCommissionPaid = totalCommissionPaidAgg._sum.amount || new Decimal(0);
    
    // Agent Take-Home = Total Sales * Agent Profit Rate
    const rate = await getAgentProfitRate();
    const agentTakeHome = totalSales.mul(rate);

    const walletBalance = wallet ? Number(wallet.balance) : 0;
    const walletDebited = wallet ? Number(wallet.totalDebited) : 0;
    const walletAdded = walletBalance + walletDebited;

    res.json({
      playerCount,
      totalDeposits: totalDeposits._sum.amount || 0,
      totalSales: totalSales,
      netCommissionPaid: netCommissionPaid,
      agentTakeHome: agentTakeHome,
      activePlayers: activePlayersToday.length,
      activeGames,
      preDeposit: {
        balance: walletBalance,
        totalAdded: walletAdded,
        state: preDepositStatus.state,
        message: preDepositStatus.stateMessage,
      }
    });
  } catch (err) {
    logger.error(`[AgentAPI] Failed to fetch stats for agent ${agent.id}:`, err);
    res.status(500).json({ error: 'Failed to fetch agent statistics' });
  }
});

/**
 * GET /api/agent/commission-history
 */
router.get('/commission-history', async (req: Request, res: Response) => {
  const agent = (req as any).user;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  try {
    const history = await getAgentCommissionHistory(agent.id, page, limit);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch commission history' });
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
      include: { wallet: true },
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
 * GET /api/agent/winners
 */
router.get('/winners', async (req: Request, res: Response) => {
  const agent = (req as any).user;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  try {
    const winners = await prisma.winner.findMany({
      where: { user: { referredBy: agent.id } },
      include: { 
        user: { select: { firstName: true, telegramUsername: true } },
        game: { include: { room: true } }
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { paidAt: 'desc' }
    });
    
    const total = await prisma.winner.count({
      where: { user: { referredBy: agent.id } }
    });

    res.json({
      winners,
      total,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch branch winners' });
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
    // Use the enriched service so trueBalance + isBalanceLegit fraud checks are included
    const withdrawals = await getPendingWithdrawals(agent.id);
    res.json(withdrawals);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending withdrawals' });
  }
});

/**
 * GET /api/agent/transactions/summary
 * Returns financial summary for all players under this agent's branch
 */
router.get('/transactions/summary', async (req: Request, res: Response) => {
  const agent = (req as any).user;

  try {
    const [
      pendingDepositsAgg,
      pendingDepositsCount,
      pendingWithdrawalsAgg,
      pendingWithdrawalsCount,
      totalDepositedAgg,
      totalWithdrawnAgg
    ] = await Promise.all([
      prisma.deposit.aggregate({
        where: { user: { referredBy: agent.id }, status: 'pending' },
        _sum: { amount: true }
      }),
      prisma.deposit.count({
        where: { user: { referredBy: agent.id }, status: 'pending' }
      }),
      prisma.withdrawal.aggregate({
        where: { user: { referredBy: agent.id }, status: 'pending' },
        _sum: { amount: true }
      }),
      prisma.withdrawal.count({
        where: { user: { referredBy: agent.id }, status: 'pending' }
      }),
      prisma.deposit.aggregate({
        where: { user: { referredBy: agent.id }, status: 'approved' },
        _sum: { amount: true }
      }),
      prisma.withdrawal.aggregate({
        where: { user: { referredBy: agent.id }, status: 'approved' },
        _sum: { amount: true }
      })
    ]);

    res.json({
      pendingDepositsCount,
      pendingDepositsSum: Number(pendingDepositsAgg._sum.amount || 0),
      pendingWithdrawalsCount,
      pendingWithdrawalsSum: Number(pendingWithdrawalsAgg._sum.amount || 0),
      totalDeposited: Number(totalDepositedAgg._sum.amount || 0),
      totalWithdrawn: Number(totalWithdrawnAgg._sum.amount || 0)
    });
  } catch (err) {
    logger.error(`[AgentAPI] Failed to fetch branch transaction summary:`, err);
    res.status(500).json({ error: 'Failed to fetch transaction summary' });
  }
});

/**
 * GET /api/agent/transactions
 * Returns a detailed log of all transactions for players under this agent
 */
router.get('/transactions', async (req: Request, res: Response) => {
  const agent = (req as any).user;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  try {
    const transactions = await prisma.transaction.findMany({
      where: { 
        user: { referredBy: agent.id }
      },
      include: { 
        user: { select: { firstName: true, telegramUsername: true, telegramId: true } }
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    const total = await prisma.transaction.count({
      where: { user: { referredBy: agent.id } }
    });

    res.json({
      transactions,
      total,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    logger.error(`[AgentAPI] Failed to fetch branch transactions:`, err);
    res.status(500).json({ error: 'Failed to fetch detailed transactions' });
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

router.post('/withdrawals/:id/reject', async (req, res) => {
  const agent = (req as any).user;
  try {
    const wd = await prisma.withdrawal.findUnique({
      where: { id: req.params.id },
      include: { user: true }
    });

    if (!wd || wd.user?.referredBy !== agent.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await rejectWithdrawal(req.params.id, agent.id, req.body.reason || 'Rejected by Branch Agent');
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;

