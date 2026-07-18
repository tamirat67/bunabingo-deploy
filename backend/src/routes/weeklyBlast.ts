import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { WeeklyBlastService } from '../services/weeklyBlast.service';

const prisma = new PrismaClient();
const router = Router();

// ── TEST ONLY: Force-start a new event (no auth needed) ──────────────────────
// DELETE THIS ROUTE AFTER TESTING!
router.post('/test-start', async (req: any, res: any) => {
  try {
    // Close any open events first
    await prisma.weeklyRewardEvent.updateMany({ where: { status: 'OPEN' }, data: { status: 'CLOSED', closedAt: new Date() } });
    // Create fresh test event
    const event = await prisma.weeklyRewardEvent.create({ data: { status: 'OPEN' } });
    res.json({ success: true, message: 'Test event started!', eventId: event.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get current event status
router.get('/current', async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await WeeklyBlastService.getCurrentEvent(userId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching current weekly blast:', error);
    res.status(500).json({ error: 'Failed to fetch event status' });
  }
});

// Draw for the weekly blast
router.post('/draw', async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await WeeklyBlastService.draw(userId);
    res.json(result);
  } catch (error: any) {
    console.error('Error drawing weekly blast:', error);
    res.status(400).json({ error: error.message || 'Failed to draw' });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req: any, res: any) => {
  try {
    const leaderboard = await WeeklyBlastService.getLeaderboard();
    res.json({ leaderboard });
  } catch (error) {
    console.error('Error fetching weekly blast leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Admin: Distribute rewards and close the current event
router.post('/distribute-rewards', async (req: any, res: any) => {
  try {
    const admin = req.user;
    if (!admin || (!admin.isAdmin && admin.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const result = await WeeklyBlastService.distributeRewards(admin.id);
    res.json(result);
  } catch (error: any) {
    console.error('Error distributing weekly blast rewards:', error);
    res.status(500).json({ error: error.message || 'Failed to distribute rewards' });
  }
});

export default router;

