import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { createBot } from './bot';
import { initializeRooms } from './game/room.manager';
import { apiLimiter } from './middleware/rateLimit';
import apiRoutes from './routes/api';
import { logger } from './lib/logger';
import { config } from './config';
import prisma, { withRetry } from './lib/prisma';
import { startJobs } from './jobs';

const bot = createBot();

async function main() {
  // Global BigInt JSON serialization fix
  (BigInt.prototype as any).toJSON = function() {
    return this.toString();
  };

  // ─── Express Server ──────────────────────────────────────
  const app = express();
  app.set('trust proxy', 1); // Required for Render/Heroku reverse proxy

  app.use(cors({
    origin: '*',
    credentials: true
  }));
  app.use(helmet({
    crossOriginResourcePolicy: false,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  // Root route for testing
  app.get('/', (_req, res) => {
    res.send('Buna Bingo API is running! ☕');
  });

  // Health endpoint — must be before rate limiters so keep-alive always responds
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api', apiLimiter, apiRoutes);

  const host = '0.0.0.0';
  const port = config.server.port;
  app.listen(port, host, () => {
    logger.info(`🚀 API server running on ${host}:${port}`);
  });

  // ─── Database ────────────────────────────────────────────
  try {
    await withRetry(() => prisma.$connect());
    logger.info('✅ Database connected');
  } catch (dbErr) {
    logger.error('❌ Database connection failed after retries:', dbErr);
    // Continue anyway; Prisma will retry on the first real query
  }

  // ─── Initialize Rooms ────────────────────────────────────
  try {
    await withRetry(() => initializeRooms());
    logger.info('✅ Game rooms initialized');
  } catch (roomErr) {
    logger.error('❌ Failed to initialize rooms:', roomErr);
  }

  // ─── Background Jobs ─────────────────────────────────────
  startJobs();

  // ─── Telegram Bot ────────────────────────────────────────

  // Non-blocking: don't await so server stays responsive during bot init
  (async () => {
    try {
      // Always try to set the Menu Button if we have a Mini App URL
      try {
        await bot.telegram.setChatMenuButton({
          menuButton: {
            type: 'web_app',
            text: 'Play Buna Bingo',
            web_app: { url: `${config.bot.miniAppUrl}` }
          }
        });
        logger.info(`🤖 Chat Menu Button set to: ${config.bot.miniAppUrl}`);
      } catch (err) {
        logger.error('Failed to set Chat Menu Button:', err);
      }

      if (config.server.nodeEnv === 'production') {
        const webhookUrl = `${process.env.WEBHOOK_URL}/bot${config.bot.token}`;
        await bot.telegram.setWebhook(webhookUrl);
        app.use(`/bot${config.bot.token}`, (req: any, res: any) => {
          bot.handleUpdate(req.body, res);
        });
        logger.info(`🤖 Bot running via webhook: ${webhookUrl}`);
      } else {
        await bot.telegram.deleteWebhook();
        bot.launch();
        logger.info('🤖 Bot running via long polling');
      }
    } catch (botErr) {
      logger.error('Failed to initialize bot (non-fatal):', botErr);
    }
  })();

  // ─── Graceful Shutdown ───────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down...`);
    try { bot.stop(signal); } catch (_) {}
    await prisma.$disconnect();
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(err => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
