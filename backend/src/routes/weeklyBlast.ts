import { Router } from 'express';
import { WeeklyBlastService } from '../services/weeklyBlast.service';
import { authenticate } from '../middleware/auth'; // Ensure this matches existing auth middleware

const router = Router();

// Get current event status
router.get('/current', authenticate, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const result = await WeeklyBlastService.getCurrentEvent(userId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching current weekly blast:', error);
    res.status(500).json({ error: 'Failed to fetch event status' });
  }
});

// Draw for the weekly blast
router.post('/draw', authenticate, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const result = await WeeklyBlastService.draw(userId);
    res.json(result);
  } catch (error: any) {
    console.error('Error drawing weekly blast:', error);
    res.status(400).json({ error: error.message || 'Failed to draw' });
  }
});

// Get leaderboard
router.get('/leaderboard', authenticate, async (req: any, res: any) => {
  try {
    const leaderboard = await WeeklyBlastService.getLeaderboard();
    res.json({ leaderboard });
  } catch (error) {
    console.error('Error fetching weekly blast leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
