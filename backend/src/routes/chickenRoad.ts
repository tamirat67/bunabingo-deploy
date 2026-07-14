import { Router, Request, Response } from 'express';
import { telegramAuthMiddleware } from '../middleware/auth';
import { startRound, resolveStep, cashoutRound } from '../services/chickenRoad.service';
import { logger } from '../lib/logger';
import { getIO } from '../lib/socket';

const router = Router();

// Apply auth middleware to all routes here
router.use(telegramAuthMiddleware);

router.post('/start', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { bet, tier, clientSeed } = req.body;
    if (!bet || !tier) return res.status(400).json({ error: 'Missing bet or tier' });

    const result = await startRound(userId, Number(bet), tier, clientSeed);
    
    // Broadcast balance update
    getIO().to(`user_${userId}`).emit('balance-updated', { newBalance: result.newBalance });
    
    res.json(result);
  } catch (err: any) {
    logger.error('[ChickenRoad] startRound error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.post('/step', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { roundId } = req.body;
    if (!roundId) return res.status(400).json({ error: 'Missing roundId' });

    const result = await resolveStep(userId, roundId);
    res.json(result);
  } catch (err: any) {
    logger.error('[ChickenRoad] resolveStep error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.post('/cashout', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { roundId } = req.body;
    if (!roundId) return res.status(400).json({ error: 'Missing roundId' });

    const result = await cashoutRound(userId, roundId);
    
    // Broadcast balance update
    getIO().to(`user_${userId}`).emit('balance-updated', { newBalance: result.newBalance });
    
    res.json(result);
  } catch (err: any) {
    logger.error('[ChickenRoad] cashoutRound error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

export default router;
