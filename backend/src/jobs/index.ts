import cron from 'node-cron';
import axios from 'axios';
import { runFraudDetection } from './fraud.detector';
import { updateBotDescription } from './bot.description.updater';
import { logger } from '../lib/logger';
import { Telegraf } from 'telegraf';

const SELF_URL = 'https://bunabingo.onrender.com/health';

export function startJobs(bot: Telegraf): void {
  // Fraud detection every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      await runFraudDetection();
    } catch (err) {
      logger.error('[Jobs] Fraud detection error:', err);
    }
  });

  // Update bot description with active user count every hour
  cron.schedule('0 * * * *', async () => {
    try {
      await updateBotDescription(bot);
    } catch (err) {
      logger.error('[Jobs] Bot description update error:', err);
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

  // Automated Deposit Verification every 1 minute (Fast & Fair)
  cron.schedule('*/1 * * * *', async () => {
    try {
      const { processAutomatedDeposits } = await import('./deposit.verifier');
      await processAutomatedDeposits();
    } catch (err) {
      logger.error('[Jobs] Deposit verification error:', err);
    }
  });

  // Weekly Saturday Reward Blast (09:00 EAT every Saturday)
  cron.schedule('0 9 * * 6', async () => {
    try {
      const { launchWeeklyBlastEvent } = await import('./weeklyBlast.job');
      await launchWeeklyBlastEvent();
    } catch (err) {
      logger.error('[Jobs] Weekly Blast launch error:', err);
    }
  }, { timezone: 'Africa/Addis_Ababa' });

  // Auto-close Weekly Blast every hour if expired (24hrs limit)
  cron.schedule('0 * * * *', async () => {
    try {
      const { autoCloseWeeklyBlast } = await import('./weeklyBlast.job');
      await autoCloseWeeklyBlast();
    } catch (err) {
      logger.error('[Jobs] Weekly Blast auto-close error:', err);
    }
  });

  logger.info('✅ Background jobs started (Auto-Deposit Scan every 1min, fraud scan every 30min, description update every 1h, cleanup every 1h, DB ping every 4min, Weekly Blast scheduled)');
}
