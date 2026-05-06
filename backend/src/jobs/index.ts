import cron from 'node-cron';
import axios from 'axios';
import { runFraudDetection } from './fraud.detector';
import { logger } from '../lib/logger';

const SELF_URL = 'https://bunabingo.onrender.com/health';

export function startJobs(): void {
  // Fraud detection every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      await runFraudDetection();
    } catch (err) {
      logger.error('[Jobs] Fraud detection error:', err);
    }
  });

  // Cleanup cancelled/old waiting games every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const { prisma } = await import('../lib/prisma');
      const staleDate = new Date(Date.now() - 6 * 60 * 60 * 1000); // 6 hours old
      const stale = await prisma.game.findMany({
        where: { status: 'WAITING', createdAt: { lt: staleDate }, tickets: { none: {} } },
      });
      if (stale.length) {
        await prisma.game.updateMany({
          where: { id: { in: stale.map(g => g.id) } },
          data: { status: 'CANCELLED', cancelReason: 'Stale waiting game (auto-cleanup)' },
        });
        logger.info(`[Jobs] Cleaned up ${stale.length} stale waiting games`);
      }
    } catch (err) {
      logger.error('[Jobs] Cleanup error:', err);
    }
  });

  // DB & Server keep-alive ping every 4 minutes
  cron.schedule('*/4 * * * *', async () => {
    try {
      const { prisma } = await import('../lib/prisma');
      await prisma.$queryRaw`SELECT 1`;
      // Also ping self to keep Render awake
      await axios.get(SELF_URL);
    } catch (err) {
      logger.warn('[Jobs] Keep-alive ping failed, reconnecting...');
      try {
        const { prisma } = await import('../lib/prisma');
        await prisma.$disconnect();
        await prisma.$connect();
      } catch (_) {}
    }
  });

  logger.info('✅ Background jobs started (fraud scan every 30min, cleanup every 1h, DB ping every 4min)');
}
